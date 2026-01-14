function getAllTickers() {
    // Select all div elements with the class 'tickerList__name__short'
    const tickerElements = document.querySelectorAll('.tickerList__name__short');
    
    // Extract the text content from each ticker element and store in an array
    const tickers = Array.from(tickerElements).map(element => element.textContent.trim());
    
    // Return the array of tickers
    return tickers;
  }
  
  // Example usage:
  const tickerArray = getAllTickers();
  console.log(tickerArray);
  