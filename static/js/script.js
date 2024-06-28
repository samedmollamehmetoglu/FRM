document.getElementById('portfolio-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const selectedStocks = Array.from(document.getElementById('tickers').selectedOptions).map(option => option.value);
    const action = event.submitter.value;

    const efficientFrontierContainer = document.getElementById('efficient-frontier');
    efficientFrontierContainer.innerHTML = ''; // Den Container leeren

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
        // Update der HTML-Elemente mit den erhaltenen Daten
        document.getElementById('weights').innerText = `Weights: ${data.weights.join(', ')}`;
        document.getElementById('return').innerText = `Expected Return: ${data.return}`;
        document.getElementById('risk').innerText = `Risk (Standard Deviation): ${data.risk}`;
        document.getElementById('max-sharpe').innerText = `Max Sharpe Ratio: ${data.max_sharpe_ratio_return} (Risk: ${data.max_sharpe_ratio_risk})`;
        document.getElementById('min-volatility').innerText = `Min Volatility: ${data.min_volatility_return} (Risk: ${data.min_volatility_risk})`;
        
        // Wenn Aktion 'show-stocks' ist, dann das Bild abrufen
        if (action === 'show-stocks') {
            fetch('/cumulative_sum', {
                method: 'GET'
            })
            .then(response => response.json())
            .then(result => {
                console.log(result);
        
                const imgElement = document.createElement('img');
                imgElement.src = result.image_path;
                imgElement.alt = 'Cumulative Plot';
                imgElement.classList.add('img-thumbnail', 'mt-3');
                imgElement.style.width = '100%';
                
                // Fügen Sie das Bild in das Div mit der ID efficient-frontier ein
                const efficientFrontierContainer = document.getElementById('efficient-frontier');
                efficientFrontierContainer.innerHTML = '';
                efficientFrontierContainer.appendChild(imgElement);
            })
            .catch(error => {
                console.error('Error fetching image:', error);
            });
        } 
        
        else if (action === 'optimize') {
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
                console.log(result);
    
                const imgElement = document.createElement('img');
                imgElement.src = result.image_path;
                imgElement.alt = 'Efficient Frontier';
                imgElement.classList.add('img-thumbnail', 'mt-3');
                imgElement.style.width = '100%';
    
                const efficientFrontierContainer = document.getElementById('efficient-frontier');
                efficientFrontierContainer.innerHTML = '';
                efficientFrontierContainer.appendChild(imgElement);
            })
            .catch(error => {
                console.error('Error fetching image:', error);
            });
        } 

    });

    //Show selected stocks
    const selectedStocksContainer = document.getElementById('selected-stocks');
    selectedStocksContainer.innerHTML = '';
    selectedStocks.forEach(stock => {
        const selectedStock = document.createElement('div');
        selectedStock.classList.add('selected-stock');
        selectedStock.innerText = stock;
        selectedStocksContainer.appendChild(selectedStock);
    }); 
});
