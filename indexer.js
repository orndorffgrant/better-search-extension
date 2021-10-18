browser.runtime.sendMessage({
  type: "index_main_page",
  args: {
    url: document.URL,
    title: document.title,
    content: document.body.innerText,
  }
});
