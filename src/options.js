let msg, bg
	
document.addEventListener("DOMContentLoaded", () => {

	msg = document.getElementById("msg")
	bg	= browser.extension.getBackgroundPage()
	document.querySelector("form").addEventListener("submit", saveOptions)
	document.getElementById("reset").addEventListener("click", resetOptions)
	restoreOptions()
})

function restoreOptions() {												//console.log("restoreOptions", bg.opts)
	
	document.getElementById("keyhigh").checked	= bg.opts.keyhigh
	document.getElementById("hosts").value		= bg.opts.hosts			
}
function saveOptions(e) {												//console.log("saveOptions")
	
	e.preventDefault();
	storeOptions({
		keyhigh: document.getElementById("keyhigh").checked,
		hosts:  document.getElementById("hosts").value
	})
		.then(bg.optsGetAndListen, null)
}
function resetOptions(e) {												//console.log("resetOptions", bg.defaultOpts)
	
	e.preventDefault()
	storeOptions(bg.defaultOpts)
		.then(bg.optsSet, null)
		.then(restoreOptions, null)		
}
function storeOptions(o) {												//console.log("storeOptions", o)

	return browser.storage.local.set(o)
		.then(storeSuccess, storeFail)
}
function storeSuccess() {
	
	msg.textContent = "Options successfully saved."
	msg.classList.add("success")
}
function storeFail(e) {
	
	console.error(`Error: ${e}`)
	msg.textContent = `Error while saving your options: ${e}`
	msg.classList.add("warning")
}