document.addEventListener('DOMContentLoaded', function() {
    const tickersDropdown = document.getElementById('tickers');
    const selectedStocksContainer = document.getElementById('selected-stocks');
    const portfolioForm = document.getElementById('portfolio-form');
    const showStocksBtn = document.getElementById('show-stocks-btn');
    const optimizeBtn = document.getElementById('optimize-btn');

    function updateSelectedStocks() {
        const selectedOptions = Array.from(tickersDropdown.selectedOptions).map(option => option.value);
        selectedStocksContainer.innerHTML = '';

        selectedOptions.forEach(stock => {
            const stockDiv = document.createElement('div');
            stockDiv.classList.add('selected-stock', 'd-flex', 'justify-content-between', 'align-items-center', 'mb-2');
            stockDiv.innerText = stock;

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'ml-2');
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', function() {
                const index = Array.from(tickersDropdown.options).findIndex(option => option.value === stock);
                tickersDropdown.options[index].selected = false;
                updateSelectedStocks();
            });

            stockDiv.appendChild(removeBtn);
            selectedStocksContainer.appendChild(stockDiv);
        });

        // Enable or disable buttons based on selected stocks count
        const selectedStocksCount = selectedOptions.length;
        showStocksBtn.disabled = selectedStocksCount < 4;
        optimizeBtn.disabled = selectedStocksCount < 4;
    }

    tickersDropdown.addEventListener('change', updateSelectedStocks);

    portfolioForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const selectedStocks = Array.from(tickersDropdown.selectedOptions).map(option => option.value);
        const action = event.submitter.value;

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
            document.getElementById('max-sharpe').innerText = `Max Sharpe Ratio: ${data.max_sharpe_ratio_return} (Risk: ${data.max_sharpe_ratio_risk})`;
            document.getElementById('min-volatility').innerText = `Min Volatility: ${data.min_volatility_return} (Risk: ${data.min_volatility_risk})`;

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
        });

        updateSelectedStocks();  // Update selected stocks and reattach event listeners
    });

    updateSelectedStocks();  // Initial update and event listener attachment
});
