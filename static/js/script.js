document.addEventListener('DOMContentLoaded', function() {
    const selectedStocksContainer = document.getElementById('selected-stocks');
    const tickersSelect = document.getElementById('tickers');
    const addStockBtn = document.getElementById('add-stock-btn');
    let selectedStocks = [];

    addStockBtn.addEventListener('click', function() {
        const selectedTicker = tickersSelect.value;
        if (!selectedStocks.includes(selectedTicker) && selectedStocks.length < 10) { // Ensure no duplicates and max 10 stocks
            selectedStocks.push(selectedTicker);
            updateSelectedStocks();
        }
    });

    function updateSelectedStocks() {
        selectedStocksContainer.innerHTML = '';
        selectedStocks.forEach(stock => {
            const stockDiv = document.createElement('div');
            stockDiv.classList.add('selected-stock');
            stockDiv.innerHTML = `${stock} <span class="remove-stock" data-ticker="${stock}">&times;</span>`;
            selectedStocksContainer.appendChild(stockDiv);
        });
    }

    selectedStocksContainer.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-stock')) {
            const ticker = event.target.getAttribute('data-ticker');
            selectedStocks = selectedStocks.filter(stock => stock !== ticker);
            updateSelectedStocks();
        }
    });

    document.getElementById('portfolio-form').addEventListener('submit', function(event) {
        event.preventDefault();

        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const action = event.submitter.value;

        if (selectedStocks.length < 4) {
            alert('Please select at least 4 stocks.');
            return;
        }

        const efficientFrontierContainer = document.getElementById('efficient-frontier');
        efficientFrontierContainer.innerHTML = ''; // Clear the container

        let url = '/optimize';
        if (action === 'show-stocks') {
            url = '/equal';
        }

        fetch(url, {
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

            if (action === 'show-stocks') {
                fetch('/cumulative_sum', {
                    method: 'GET'
                })
                .then(response => response.json())
                .then(result => {
                    const imgElement = document.createElement('img');
                    imgElement.src = result.image_path;
                    imgElement.alt = 'Cumulative Plot';
                    imgElement.classList.add('img-thumbnail', 'mt-3');
                    imgElement.style.width = '100%';
                    efficientFrontierContainer.innerHTML = '';
                    efficientFrontierContainer.appendChild(imgElement);
                })
                .catch(error => console.error('Error fetching image:', error));
            } else if (action === 'optimize') {
                fetch('/efficient_frontier', {
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
                .then(result => {
                    const imgElement = document.createElement('img');
                    imgElement.src = result.image_path;
                    imgElement.alt = 'Efficient Frontier';
                    imgElement.classList.add('img-thumbnail', 'mt-3');
                    imgElement.style.width = '100%';
                    efficientFrontierContainer.innerHTML = '';
                    efficientFrontierContainer.appendChild(imgElement);
                })
                .catch(error => console.error('Error fetching image:', error));

                fetch('/get_portfolio_table', {
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
                    const tableContainer = document.getElementById('portfolio-table');
                    tableContainer.innerHTML = '';

                    const table = document.createElement('table');
                    table.classList.add('table', 'table-striped', 'mt-4');
                    
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    const headers = ['Portfolio Type', 'Expected Return (%)', 'Volatility (Risk) (%)', ...selectedStocks.map(stock => `${stock} Weight (%)`)];
                    
                    headers.forEach(header => {
                        const th = document.createElement('th');
                        th.innerText = header;
                        headerRow.appendChild(th);
                    });
                    
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    
                    const tbody = document.createElement('tbody');
                    
                    const portfolios = ['max_sharpe', 'min_volatility', 'max_return'];
                    const portfolioNames = ['Max Sharpe Ratio', 'Min Volatility', 'Max Return'];
                    
                    portfolios.forEach((portfolio, index) => {
                        const row = document.createElement('tr');
                        const portfolioTypeCell = document.createElement('td');
                        portfolioTypeCell.innerText = portfolioNames[index];
                        row.appendChild(portfolioTypeCell);
                        
                        const returnCell = document.createElement('td');
                        returnCell.innerText = (data[portfolio].return * 100).toFixed(2);
                        row.appendChild(returnCell);

                        const riskCell = document.createElement('td');
                        riskCell.innerText = (data[portfolio].risk * 100).toFixed(2);
                        row.appendChild(riskCell);
                        
                        data[portfolio].weights.forEach(weight => {
                            const weightCell = document.createElement('td');
                            weightCell.innerText = (weight * 100).toFixed(2);
                            row.appendChild(weightCell);
                        });
                        
                        tbody.appendChild(row);
                    });
                    
                    table.appendChild(tbody);
                    tableContainer.appendChild(table);
                })
                .catch(error => console.error('Error fetching portfolio table:', error));
            }
        })
        .catch(error => console.error('Error processing request:', error));
    });
});
