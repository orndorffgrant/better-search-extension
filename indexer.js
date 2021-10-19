browser.runtime.sendMessage({
  type: "index",
  args: {
    url: document.URL,
    title: document.title,
    content: document.body.innerText,
  }
});
