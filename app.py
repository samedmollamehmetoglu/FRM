from flask import Flask, request, jsonify, render_template, send_from_directory
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.optimize import minimize
import cvxopt as opt
from cvxopt import solvers
from cvxopt import matrix as opt_matrix
import os

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

def simulate_portfolios(returns, n_portfolios=3000):
    pf_mus, pf_sigmas = np.column_stack([calculate_portfolio_return_and_risk(returns) for _ in range(n_portfolios)])
    return pf_mus, pf_sigmas

def calculate_frontier(returns):
    returns = pd.DataFrame(returns)
    cov = np.matrix(np.cov(returns.T))
    N = returns.shape[1]
    pbar = np.matrix(returns.mean())
    
    optimal_mus = []
    r_min = pbar.min()
    r_max = pbar.max()
    for i in np.linspace(r_min, r_max, 50):
        optimal_mus.append(i)
    
    P = opt.matrix(cov)
    q = opt.matrix(np.zeros((N, 1)))
    G = opt.matrix(np.concatenate((-np.array(pbar), -np.identity(N)), 0))
    A = opt.matrix(1.0, (1, N))
    b = opt.matrix(1.0)
    
    opt.solvers.options['show_progress'] = False
    
    optimal_weights = []
    optimal_sigmas = []
    
    for mu in optimal_mus:
        try:
            h = opt.matrix(np.concatenate((np.array([-mu]), np.zeros(N))))
            weights = solvers.qp(P, q, G, h, A, b)['x']
            optimal_weights.append(weights)
            optimal_sigmas.append(np.sqrt(np.matrix(weights).T * cov.T.dot(np.matrix(weights)))[0, 0])
        except ValueError as e:
            print(f"Optimization error for mu={mu}: {e}")

    return optimal_weights, optimal_mus, optimal_sigmas

def calculate_optimal_portfolio(returns, risk_free_rate=0.0):
    returns = pd.DataFrame(returns)
    cov = np.cov(returns.T)
    N = returns.shape[1]
    pbar = returns.mean().values.reshape(-1, 1)
    
    P = opt_matrix(cov)
    q = opt_matrix(np.zeros((N, 1)))
    G = opt_matrix(-np.identity(N))
    h = opt_matrix(np.zeros((N, 1)))
    A = opt_matrix(1.0, (1, N))
    b = opt_matrix(1.0)
    
    solvers.options['show_progress'] = False
    
    def sharpe_ratio(weights):
        return -((np.dot(weights.T, pbar) - risk_free_rate) / np.sqrt(np.dot(weights.T, np.dot(cov, weights))))

    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
    bounds = tuple((0, 1) for asset in range(N))
    result = minimize(sharpe_ratio, N * [1. / N,], method='SLSQP', bounds=bounds, constraints=constraints)
    
    optimal_weights = result.x
    optimal_return = np.dot(optimal_weights.T, pbar).item()
    optimal_risk = np.sqrt(np.dot(optimal_weights.T, np.dot(cov, optimal_weights))).item()
    max_sharpe_ratio = (optimal_return - risk_free_rate) / optimal_risk
    
    return {
        'weights': optimal_weights.tolist(),
        'return': optimal_return,
        'risk': optimal_risk,
        'sharpe_ratio': max_sharpe_ratio
    }

def get_min_volatility_portfolio(returns):
    cov_matrix = np.cov(returns.T)
    num_assets = len(returns.columns)
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
    bounds = tuple((0, 1) for asset in range(num_assets))
    initial_weights = num_assets * [1. / num_assets, ]

    def min_volatility_objective(weights):
        return np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))

    min_vol_result = minimize(min_volatility_objective, initial_weights, method='SLSQP', bounds=bounds, constraints=constraints)
    min_vol_weights = min_vol_result.x
    min_vol_return = np.dot(min_vol_weights, returns.mean())
    min_vol_risk = np.sqrt(np.dot(min_vol_weights.T, np.dot(cov_matrix, min_vol_weights)))

    return {
        'weights': min_vol_weights.tolist(),
        'return': min_vol_return,
        'risk': min_vol_risk
    }

def get_max_return_portfolio(returns):
    num_assets = len(returns.columns)
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1})
    bounds = tuple((0, 1) for asset in range(num_assets))
    initial_weights = num_assets * [1. / num_assets, ]

    def max_return_objective(weights):
        return -np.dot(weights, returns.mean())

    max_return_result = minimize(max_return_objective, initial_weights, method='SLSQP', bounds=bounds, constraints=constraints)
    max_return_weights = max_return_result.x
    max_return_return = np.dot(max_return_weights, returns.mean())
    max_return_risk = np.sqrt(np.dot(max_return_weights.T, np.dot(np.cov(returns.T), max_return_weights)))

    return {
        'weights': max_return_weights.tolist(),
        'return': max_return_return,
        'risk': max_return_risk
    }

def calculate_equal_distribution(returns, tickers):
    N = returns.shape[1]
    weights = np.ones(N) / N

    cov = np.cov(returns.T)
    pbar = returns.mean().values.reshape(-1, 1)
    optimal_return = np.dot(weights.T, pbar).item()
    optimal_risk = np.sqrt(np.dot(weights.T, np.dot(cov, weights))).item()

    plt.figure(figsize=(10, 6))
    colors = plt.cm.plasma(np.linspace(0, 3, 20))
    for i in range(returns.shape[1]):
        cumulative_returns = returns.iloc[:, i].cumsum() * 100  # Convert to percentage
        plt.plot(cumulative_returns, label=tickers[i], color=colors[i])

    plt.legend(loc='best')
    plt.title('Cumulative Sum of the Assets')
    plt.ylabel('Cumulative Daily Returns (%)')  # Updated y-axis label
    plt.xlabel('Time')
    static = os.path.join(os.getcwd(), 'static')
    filename = os.path.join(static, 'cumulative_plot.png')
    plt.savefig(filename)
    plt.close()

    return {
        'weights': weights.tolist(),
        'return': optimal_return,
        'risk': optimal_risk
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/efficient_frontier', methods=['POST'])
def get_efficient_frontier():
    data = request.get_json()
    tickers = data['tickers']
    date_range = data['date_range']

    stock_data = yf.download(tickers, start=date_range[0], end=date_range[1])['Adj Close']
    returns = stock_data.pct_change().dropna()
    
    pf_mus, pf_sigmas = simulate_portfolios(returns, n_portfolios=3000)
    optimal_weights, optimal_mus, optimal_sigmas = calculate_frontier(returns)
    
    max_sharpe_portfolio = calculate_optimal_portfolio(returns)
    min_vol_portfolio = get_min_volatility_portfolio(returns)
    max_return_portfolio = get_max_return_portfolio(returns)

    plt.plot(pf_sigmas, pf_mus, 'o', markersize=5, label='Available Market Portfolio')
    plt.plot(optimal_sigmas, optimal_mus, 'y-o', color='orange', markersize=8, label='Efficient Frontier')

    plt.scatter(min_vol_portfolio['risk'], min_vol_portfolio['return'], color='green', edgecolors='black', marker='o', s=100, label='Min Volatility', zorder=5)
    plt.scatter(max_sharpe_portfolio['risk'], max_sharpe_portfolio['return'], color='purple', edgecolors='black', marker='o', s=100, label='Max Sharpe Ratio', zorder=5)
    plt.scatter(max_return_portfolio['risk'], max_return_portfolio['return'], color='red', edgecolors='black', marker='o', s=100, label='Max Return', zorder=5)

    plt.xlabel('Expected Volatility')
    plt.ylabel('Expected Return')
    plt.title('Efficient Frontier and Available Portfolios')
    plt.legend(loc='best')

    static = os.path.join(os.getcwd(), 'static')
    if not os.path.exists(static):
        os.makedirs(static)
    filename = os.path.join(static, 'efficient_frontier.png')
    plt.savefig(filename)
    plt.close()

    global efficient_frontier
    efficient_frontier = 'efficient_frontier.png'

    normal_portfolio = calculate_equal_distribution(returns, tickers)

    if efficient_frontier:
        return jsonify({
            "image_path": f"/static/{efficient_frontier}",
            "normal_portfolio": normal_portfolio,
            "max_sharpe": max_sharpe_portfolio,
            "min_volatility": min_vol_portfolio,
            "max_return": max_return_portfolio
        }), 200
    else:
        return jsonify({"error": "No image available"}), 404

@app.route('/optimize', methods=['POST'])
def optimize():
    data = request.get_json()
    tickers = data['tickers']
    date_range = data['date_range']

    stock_data = yf.download(tickers, start=date_range[0], end=date_range[1])['Adj Close']
    returns = stock_data.pct_change().dropna()
    
    calculate = calculate_optimal_portfolio(returns)
    return jsonify(calculate)

@app.route('/cumulative_sum', methods=['GET'])
def get_img():
    global cumulative_plot_png
    cumulative_plot_png = 'cumulative_plot.png'

    if cumulative_plot_png:
        return jsonify({"image_path": f"/static/{cumulative_plot_png}"}), 200
    else:
        return jsonify({"error": "No image available"}), 404

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/get_portfolio_table', methods=['POST'])
def get_portfolio_table():
    data = request.get_json()
    tickers = data['tickers']
    date_range = data['date_range']

    stock_data = yf.download(tickers, start=date_range[0], end=date_range[1])['Adj Close']
    returns = stock_data.pct_change().dropna()

    max_sharpe = calculate_optimal_portfolio(returns)
    min_volatility = get_min_volatility_portfolio(returns)
    max_return = get_max_return_portfolio(returns)
    normal_portfolio = calculate_equal_distribution(returns, tickers)

    result = {
        'max_sharpe': max_sharpe,
        'min_volatility': min_volatility,
        'max_return': max_return,
        'normal_portfolio': normal_portfolio
    }

    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
