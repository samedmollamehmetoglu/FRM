document.addEventListener('DOMContentLoaded', function() {
    const portfolioForm = document.getElementById('portfolio-form');
    const selectedStocksContainer = document.getElementById('selected-stocks');
    const tickersSelect = document.getElementById('tickers');
    const addStockBtn = document.getElementById('add-stock-btn');
    const optimizeBtn = document.getElementById('optimize');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const efficientFrontierDescription = document.getElementById('efficient-frontier-description');
    const cumulativePlotDescription = document.getElementById('cumulative-plot-description');

    const today = new Date().toISOString().split('T')[0];
    const minDate = '2009-01-01';
    startDateInput.setAttribute('max', today);
    startDateInput.setAttribute('min', minDate);
    endDateInput.setAttribute('max', today);
    endDateInput.setAttribute('min', minDate);

    efficientFrontierDescription.style.display = 'none';
    cumulativePlotDescription.style.display = 'none';

    function updateButtonsState() {
        const selectedStocks = selectedStocksContainer.querySelectorAll('.selected-stock').length;
        optimizeBtn.disabled = selectedStocks < 4 || selectedStocks > 10;
        addStockBtn.disabled = selectedStocks >= 10;
    }

    function validateDates() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        const minEndDate = new Date(startDate);
        minEndDate.setMonth(minEndDate.getMonth() + 3);

        if (startDate && endDate) {
            if (startDate > endDate) {
                alert('Start date must be before end date.');
                return false;
            } else if (endDate < minEndDate) {
                alert('End date must be at least 3 months after the start date.');
                return false;
            }
        }
        return true;
    }

    addStockBtn.addEventListener('click', function() {
        const selectedOption = tickersSelect.selectedOptions[0];
        if (selectedOption) {
            const stockDiv = document.createElement('div');
            stockDiv.className = 'selected-stock';
            stockDiv.innerHTML = `${selectedOption.text} <button class="remove-stock-btn btn btn-danger btn-sm ml-2">x</button>`;
            selectedStocksContainer.appendChild(stockDiv);
            selectedOption.remove();
            updateButtonsState();
        }
    });

    selectedStocksContainer.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-stock-btn')) {
            const stockDiv = event.target.parentElement;
            const stockText = stockDiv.textContent.replace(' x', '').trim();
            const option = document.createElement('option');
            option.text = stockText;
            option.value = stockText.match(/\(([^)]+)\)/)[1];
            tickersSelect.appendChild(option);
            stockDiv.remove();
            updateButtonsState();
        }
    });

    portfolioForm.addEventListener('submit', function(event) {
        event.preventDefault();

        if (!validateDates()) {
            return;
        }

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const selectedStocks = Array.from(selectedStocksContainer.querySelectorAll('.selected-stock')).map(stock => stock.textContent.replace(' x', '').trim().match(/\(([^)]+)\)/)[1]);

        const efficientFrontierContainer = document.getElementById('efficient-frontier');
        const portfolioTableContainer = document.getElementById('portfolio-table');
        const cumulativePlotContainer = document.getElementById('cumulative-plot');
        const disclaimerContainer = document.getElementById('disclaimer');
        efficientFrontierContainer.innerHTML = '';
        portfolioTableContainer.innerHTML = '';
        cumulativePlotContainer.innerHTML = '';
        disclaimerContainer.innerHTML = '';

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
        .then(data => {
            const imgElement = document.createElement('img');
            imgElement.src = data.image_path;
            imgElement.alt = 'Efficient Frontier';
            imgElement.classList.add('img-thumbnail', 'mt-3');
            imgElement.style.width = '100%';
            efficientFrontierContainer.innerHTML = '';
            efficientFrontierContainer.appendChild(imgElement);
            efficientFrontierDescription.style.display = 'block';

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

            const portfolios = ['normal_portfolio', 'max_sharpe', 'min_volatility', 'max_return'];
            const portfolioNames = ['Normal Portfolio', 'Max Sharpe Ratio', 'Min Volatility', 'Max Return'];

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
            portfolioTableContainer.appendChild(table);

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
                cumulativePlotContainer.innerHTML = '';
                cumulativePlotContainer.appendChild(imgElement);
                cumulativePlotDescription.style.display = 'block';

                disclaimerContainer.innerHTML = '<p><strong>Disclaimer:</strong> The Markowitz portfolio optimization is based on historical data and assumes that past performance is indicative of future results. This method also assumes that asset returns are normally distributed, which might not always be the case in real market conditions. Investors should use these results with caution and consider other factors before making investment decisions.</p>';
            })
            .catch(error => console.error('Error fetching image:', error));
        })
        .catch(error => console.error('Error fetching data:', error));
    });
});
