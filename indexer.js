document.body.style.border = "5px solid green";

browser.runtime.sendMessage({
  type: "index_main_page",
  args: {
    url: document.URL,
    title: document.title,
    content: document.body.innerText,
  }
});


function lookup(args) {
  browser.runtime.sendMessage({
    type: "lookup",
    args,
  }).then((results) => {
    console.log(results);
  })
}