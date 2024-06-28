from flask import Flask, request, jsonify, render_template
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import minimize

app = Flask(__name__)

def generate_random_weights(n_assets):
    w = np.random.rand(n_assets)
    return w / w.sum()

def calculate_portfolio_return_and_risk(returns):
    returns = pd.DataFrame(returns)
    cov = np.matrix(returns.cov())
    R = np.matrix(returns.mean())
    w = np.matrix(generate_random_weights(returns.shape[1]))
    mu = w * R.T
    sigma = np.sqrt(w * cov * w.T)
    return mu.item(), sigma.item()

def simulate_portfolios(returns, n_portfolios=1500):
    pf_mus, pf_sigmas = np.column_stack([calculate_portfolio_return_and_risk(returns) for _ in range(n_portfolios)])
    return pf_mus, pf_sigmas

def optimize_portfolio(returns):
    def portfolio_variance(weights, cov_matrix):
        return weights.T @ cov_matrix @ weights

    returns = pd.DataFrame(returns)
    cov_matrix = returns.cov().values
    n_assets = len(returns.columns)
    args = (cov_matrix,)
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
    bounds = tuple((0, 1) for _ in range(n_assets))
    result = minimize(portfolio_variance, n_assets * [1. / n_assets,], args=args, method='SLSQP', bounds=bounds, constraints=constraints)
    
    return result.x

def optimize_portfolio_returns(returns, n_portfolios=3000):
    pf_mus, pf_sigmas = simulate_portfolios(returns, n_portfolios)
    max_sharpe_ratio_index = np.argmax(pf_mus / pf_sigmas)
    min_volatility_index = np.argmin(pf_sigmas)
    max_sharpe_ratio_return, max_sharpe_ratio_risk = pf_mus[max_sharpe_ratio_index], pf_sigmas[max_sharpe_ratio_index]
    min_volatility_return, min_volatility_risk = pf_mus[min_volatility_index], pf_sigmas[min_volatility_index]
    return max_sharpe_ratio_return, max_sharpe_ratio_risk, min_volatility_return, min_volatility_risk

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/optimize', methods=['POST'])
def optimize():
    data = request.get_json()
    tickers = data['tickers']
    date_range = data['date_range']
    
    # Fetch data from Yahoo Finance
    stock_data = yf.download(tickers, start=date_range[0], end=date_range[1])['Adj Close']
    returns = stock_data.pct_change().dropna()
    
    # Optimize portfolio
    optimal_weights = optimize_portfolio(returns)
    optimal_return, optimal_risk = calculate_portfolio_return_and_risk(returns)
    
    # Simulate portfolios
    pf_mus, pf_sigmas = simulate_portfolios(returns)
    
    # Optimize portfolio returns
    max_sharpe_ratio_return, max_sharpe_ratio_risk, min_volatility_return, min_volatility_risk = optimize_portfolio_returns(returns)
    
    response = {
        'weights': optimal_weights.tolist(),
        'return': optimal_return,
        'risk': optimal_risk,
        'portfolios_risk': pf_sigmas.tolist(),  # Add simulated portfolios' risks
        'portfolios_return': pf_mus.tolist(),   # Add simulated portfolios' returns
        'frontier_x': pf_sigmas.tolist(),
        'frontier_y': pf_mus.tolist(),
        'max_sharpe_ratio_return': max_sharpe_ratio_return,
        'max_sharpe_ratio_risk': max_sharpe_ratio_risk,
        'min_volatility_return': min_volatility_return,
        'min_volatility_risk': min_volatility_risk
    }
    }

    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)
