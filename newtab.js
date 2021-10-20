const search = document.getElementById("search");
const resultsContainer = document.getElementById("results");
const resultTemplate = document.querySelector("#result");

search.onchange = () => {
  browser.runtime.sendMessage({
    type: "lookup",
    args: {
        searchString: search.value
    },
  }).then((results) => {
    resultsContainer.innerHTML = "";
    results.forEach(result => {
      const resultElement = resultTemplate.content.cloneNode(true);
      const a = resultElement.querySelector("a");
      a.href = result.url;
      a.innerText = result.title;
      resultsContainer.appendChild(resultElement);
    })
  })
};
