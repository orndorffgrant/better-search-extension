function index() {
  browser.runtime.sendMessage({
    type: "index",
    args: {
      url: document.URL,
      title: document.title,
      content: document.body.innerText,
    }
  });
}

setTimeout(() => {
  index();
}, 3000)

// below isn't working yet
window.history.pushState = new Proxy(window.history.pushState, {
  apply: (target, thisArg, argArray) => {
    index();
    return target.apply(thisArg, argArray);
  },
});
