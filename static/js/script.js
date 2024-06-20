document.getElementById('portfolio-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const selectedStocks = Array.from(document.getElementById('tickers').selectedOptions).map(option => option.value);

    fetch('/optimize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tickers: selectedStocks,
            date_range: [startDate, endDate]
        })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('weights').innerText = `Weights: ${data.weights.join(', ')}`;
        document.getElementById('return').innerText = `Expected Return: ${data.return}`;
        document.getElementById('risk').innerText = `Risk (Standard Deviation): ${data.risk}`;
        document.getElementById('max-sharpe').innerText = `Max Sharpe Ratio: ${data.max_sharpe_ratio_return} (Risk: ${data.max_sharpe_ratio_risk})`;
        document.getElementById('min-volatility').innerText = `Min Volatility: ${data.min_volatility_return} (Risk: ${data.min_volatility_risk})`;

        // Plot individual portfolios
        const portfoliosTrace = {
            x: data.portfolios_risk,
            y: data.portfolios_return,
            mode: 'markers',
            type: 'scatter',
            name: 'Portfolios',
            marker: {
                size: 5,
                color: 'rgba(152, 0, 0, .8)',
                line: {
                    color: 'rgba(0, 0, 0, 0.5)',
                    width: 0.5
                }
            }
        };

        // Plot Efficient Frontier
        const frontierTrace = {
            x: data.frontier_risk,
            y: data.frontier_return,
            mode: 'lines',
            name: 'Efficient Frontier',
            line: { color: 'blue' }
        };

        const dataPlot = [frontierTrace, portfoliosTrace]; // Change order of traces

        const layout = {
            title: 'Efficient Frontier and Portfolios',
            xaxis: { title: 'Risk (Standard Deviation)' },
            yaxis: { title: 'Return' }
        };

        Plotly.newPlot('efficient-frontier', dataPlot, layout);

        // Show selected stocks for Max Sharpe Ratio
        const maxSharpeStocksContainer = document.getElementById('max-sharpe-stocks');
        maxSharpeStocksContainer.innerHTML = '';
        data.max_sharpe_ratio_weights.forEach((weight, index) => {
            alert('here max sharpe stocks');
            const stock = selectedStocks[index];
            const selectedStock = document.createElement('div');
            selectedStock.classList.add('selected-stock');
            selectedStock.innerText = `${stock}: ${weight}`;
            maxSharpeStocksContainer.appendChild(selectedStock);
        });

        // Show selected stocks for Min Volatility
        const minVolatilityStocksContainer = document.getElementById('min-volatility-stocks');
        minVolatilityStocksContainer.innerHTML = '';
        data.min_volatility_weights.forEach((weight, index) => {
            const stock = selectedStocks[index];
            const selectedStock = document.createElement('div');
            selectedStock.classList.add('selected-stock');
            selectedStock.innerText = `${stock}: ${weight}`;
            minVolatilityStocksContainer.appendChild(selectedStock);
        });
    })
    .catch(error => {
        console.error('Error:', error);
    });

    // Show selected stocks
    const selectedStocksContainer = document.getElementById('selected-stocks');
    selectedStocksContainer.innerHTML = '';
    selectedStocks.forEach(stock => {
        const selectedStock = document.createElement('div');
        selectedStock.classList.add('selected-stock');
        selectedStock.innerText = stock;
        selectedStocksContainer.appendChild(selectedStock);
    });
});
