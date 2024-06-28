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

def simulate_portfolios(returns, n_portfolios=1500):
    pf_mus, pf_sigmas = np.column_stack([calculate_portfolio_return_and_risk(returns) for _ in range(n_portfolios)])
    return pf_mus, pf_sigmas


def calculate_frontier(returns):
    '''
    returns optimal portfolio weights and corresponding sigmas for a desired optimal portfolio return
    Params:
    - returns: T x N matrix of observed data
    '''
    returns = pd.DataFrame(returns)
    cov = np.matrix(np.cov(returns.T))
    N = returns.shape[1]
    pbar = np.matrix(returns.mean())
    
    # define list of optimal / desired mus for which we'd like to find the optimal sigmas
    optimal_mus = []
    r_min = pbar.mean()    # minimum expected return
    for i in range(50):
        optimal_mus.append(r_min)
        r_min += (pbar.mean() / 100)
    
    # constraint matrices for quadratic programming
    P = opt.matrix(cov)
    q = opt.matrix(np.zeros((N, 1)))
    G = opt.matrix(np.concatenate((-np.array(pbar), -np.identity(N)), 0))
    A = opt.matrix(1.0, (1,N))
    b = opt.matrix(1.0)
    
    # hide optimization
    opt.solvers.options['show_progress'] = False
    
    # calculate portfolio weights, every weight vector is of size Nx1
    # find optimal weights with qp(P, q, G, h, A, b)
    optimal_weights = [solvers.qp(P, q, G, opt.matrix(np.concatenate((-np.ones((1, 1)) * mu, np.zeros((N, 1))), 0)), A, b)['x'] for mu in optimal_mus]
    
    # find optimal sigma
    # \sigma = w^T * Cov * w
    optimal_sigmas = [np.sqrt(np.matrix(w).T * cov.T.dot(np.matrix(w)))[0,0] for w in optimal_weights]
    
    return optimal_weights, optimal_mus, optimal_sigmas


# Habe ich nicht verwendet bis jetzt
def optimize_portfolio_returns(returns, n_portfolios=3000):
    pf_mus, pf_sigmas = simulate_portfolios(returns, n_portfolios)
    max_sharpe_ratio_index = np.argmax(pf_mus / pf_sigmas)
    min_volatility_index = np.argmin(pf_sigmas)
    max_sharpe_ratio_return, max_sharpe_ratio_risk = pf_mus[max_sharpe_ratio_index], pf_sigmas[max_sharpe_ratio_index]
    min_volatility_return, min_volatility_risk = pf_mus[min_volatility_index], pf_sigmas[min_volatility_index]
    return max_sharpe_ratio_return, max_sharpe_ratio_risk, min_volatility_return, min_volatility_risk


# Normalverteilung nur für ein Portfolio -> die Rechnungen eventuell anpassen
def calculate_optimal_portfolio(returns, risk_free_rate=0.0):
    '''
    Returns the optimal portfolio weights for the highest Sharpe ratio
    Params:
    - returns: T x N matrix of observed data
    - risk_free_rate: the risk-free rate to calculate the Sharpe ratio (default is 0.0)
    '''
    returns = pd.DataFrame(returns)
    cov = np.cov(returns.T)
    N = returns.shape[1]
    pbar = returns.mean().values.reshape(-1, 1)
    
    # Constraint matrices for quadratic programming
    P = opt_matrix(cov)
    q = opt_matrix(np.zeros((N, 1)))
    G = opt_matrix(-np.identity(N))
    h = opt_matrix(np.zeros((N, 1)))
    A = opt_matrix(1.0, (1, N))
    b = opt_matrix(1.0)
    
    # Hide optimization progress
    solvers.options['show_progress'] = False
    
    def portfolio_return(weights):
        return np.dot(weights.T, pbar).item()

    def portfolio_volatility(weights):
        return np.sqrt(np.dot(weights.T, np.dot(cov, weights))).item()
    
    def sharpe_ratio(weights):
        return -((portfolio_return(weights) - risk_free_rate) / portfolio_volatility(weights))
    
    optimal_sharpe_result = solvers.qp(P, q, G, h, A, b)
    optimal_weights = np.array(optimal_sharpe_result['x']).flatten()
    
    optimal_return = portfolio_return(optimal_weights)
    optimal_risk = portfolio_volatility(optimal_weights)
    max_sharpe_ratio = (optimal_return - risk_free_rate) / optimal_risk
    
    min_volatility_return = optimal_return  # In this simplified example, we use the same optimal return
    min_volatility_risk = optimal_risk      # In this simplified example, we use the same optimal risk
    
    return {
        'weights': optimal_weights.tolist(),
        'return': optimal_return,
        'risk': optimal_risk,
        'max_sharpe_ratio_return': max_sharpe_ratio,
        'max_sharpe_ratio_risk': optimal_risk,
        'min_volatility_return': min_volatility_return,
        'min_volatility_risk': min_volatility_risk
    }




def calculate_equal_distribution(returns, tickers):
    '''
    Berechnet gleichgewichtete Gewichte für die gegebenen Renditen.
    Params:
    - returns: T x N Matrix der beobachteten Daten
    Returns:
    - weights: Array gleichgewichteter Gewichte für N Anlagen
    '''
    N = returns.shape[1]
    weights = np.ones(N) / N  # Gleichgewichtete Gewichte berechnen

    cov = np.cov(returns.T)
    pbar = returns.mean().values.reshape(-1, 1)
    optimal_return = np.dot(weights.T, pbar).item()
    optimal_risk = np.sqrt(np.dot(weights.T, np.dot(cov, weights))).item()
    max_sharpe_ratio = (optimal_return - 0.0) / optimal_risk  # max Sharpe ratio mit risk_free_rate=0.0
    min_volatility_return = optimal_return
    min_volatility_risk = optimal_risk


    plt.figure(figsize=(10, 6))
    colors = plt.cm.plasma(np.linspace(0, 3, 20))
    for i in range(returns.shape[1]):
        plt.plot(returns.iloc[:, i].cumsum(), label=f"Aktie {i+1}")

    plt.legend(loc='best')
    plt.title('Kumulierte Summe jeder Zeitreihe')
    plt.ylabel('Kumulative tägliche Aktienrendite')
    plt.xlabel('Tage')
    static = os.path.join(os.getcwd(), 'static')
    filename = os.path.join(static, 'cumulative_plot.png')
    plt.savefig(filename)

    return {
        'weights': weights.tolist(),
        'return': optimal_return,
        'risk': optimal_risk,
        'max_sharpe_ratio_return': max_sharpe_ratio,
        'max_sharpe_ratio_risk': optimal_risk,
        'min_volatility_return': min_volatility_return,
        'min_volatility_risk': min_volatility_risk,
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/efficient_frontier', methods=['POST'])
def get_efficient_frontier():
    data = request.get_json()
    tickers = data['tickers']
    date_range = data['date_range']

    # Fetch data from Yahoo Finance
    stock_data = yf.download(tickers, start=date_range[0], end=date_range[1])['Adj Close']
    returns = stock_data.pct_change().dropna()
    
    pf_mus, pf_sigmas = simulate_portfolios(returns, n_portfolios=3000)
    optimal_weights, optimal_return, optimal_risk = calculate_frontier(returns)

    plt.plot(pf_sigmas, pf_mus, 'o', markersize=5, label='Available Market Portfolio')
    plt.plot(optimal_risk, optimal_return, 'y-o', color='orange', markersize=8, label='Efficient Frontier')
    plt.xlabel('Expected Volatility')
    plt.ylabel('Expected Return')
    plt.title('Efficient Frontier and Available Portfolios')
    plt.legend(loc='best')

    static = os.path.join(os.getcwd(), 'static')
    if not os.path.exists(static):
        os.makedirs(static)
    filename = os.path.join(static, 'efficient_frontier.png')
    plt.savefig(filename)
    plt.close()  # Schließt die aktuelle Figur und gibt die Ressourcen frei

    # Sendet das generierte Diagramm an das Frontend
    global efficient_frontier
    efficient_frontier = 'efficient_frontier.png'

    if efficient_frontier:
        return jsonify({"image_path": f"/static/{efficient_frontier}"}), 200
    else:
        return jsonify({"error": "No image available"}), 404
    


# Normalverteilung -> muss angepasst werden ist nur für ein Portfolio
@app.route('/optimize', methods=['POST'])
def optimize():
    data = request.get_json()
    tickers = data['tickers']
    date_range = data['date_range']

    # Fetch data from Yahoo Finance
    stock_data = yf.download(tickers, start=date_range[0], end=date_range[1])['Adj Close']
    returns = stock_data.pct_change().dropna()
    
    calculate = calculate_optimal_portfolio(returns)
    print(calculate)
    return jsonify(calculate)



@app.route('/equal', methods=['POST'])
def equal():
    data = request.get_json()
    tickers = data['tickers']
    date_range = data['date_range']

    # Fetch data from Yahoo Finance
    stock_data = yf.download(tickers, start=date_range[0], end=date_range[1])['Adj Close']
    returns = stock_data.pct_change().dropna()

    calculate = calculate_equal_distribution(returns, tickers)
    print(calculate)
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


if __name__ == '__main__':
    app.run(debug=True)
