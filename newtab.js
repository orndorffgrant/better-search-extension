const search = document.getElementById("search");
const results = document.getElementById("results");
search.onchange = () => {
  browser.runtime.sendMessage({
    type: "lookup",
    args: {
        searchString: search.value
    },
  }).then((res) => {
      const linksarray = res.map(r => `<div><a href="${r.url}">${r.title}</a></div>`)
      results.innerHTML = linksarray.reduce((s, i) => s + i)
  })
}
