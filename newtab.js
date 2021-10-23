const search = document.getElementById("search");
const resultsContainer = document.getElementById("results");
const resultTemplate = document.querySelector("#result");

const onchange = () => {
  browser.runtime.sendMessage({
    type: "lookup",
    args: {
        searchString: search.value
    },
  }).then((results) => {
    resultsContainer.innerHTML = "";
    if (results.length > 0) {
      results.forEach(result => {
        const resultElement = resultTemplate.content.cloneNode(true);
        const a = resultElement.querySelector(".link-title");
        a.href = result.url;
        a.innerText = result.title;
        const urlspan = resultElement.querySelector(".link");
        urlspan.innerText = result.url;
        resultsContainer.appendChild(resultElement);
      })
    } else {
      resultsContainer.innerHTML = "no results";
    }
  }).catch((e) => {
      resultsContainer.innerHTML = "error: " + e;
  })
};

let debounce;
search.onkeyup = () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    onchange();
  }, 200);
};

