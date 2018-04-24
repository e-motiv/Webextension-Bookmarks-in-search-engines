let msg, bg, oTabs, template, filter

document.addEventListener("DOMContentLoaded", () => {

	msg		= document.getElementById("msg")
	bg		= browser.extension.getBackgroundPage()
	filter	= document.querySelector("#filter")
	
	//tab mechanics
	let oButs	= document.querySelectorAll("#list li")
	oTabs		= filter.children
	template	= filter.querySelector("template")
	oButs.forEach((el, i) => {
		el.tabTarget = oTabs[i].id
		el.addEventListener("click", selectTab)
	})
	
	restoreOptions()
	
	filter.querySelectorAll(".section button").forEach(el => {
		el.addEventListener("click", addFilterMan)
	})
	
	document.querySelector("form").addEventListener("submit", saveOptions)
	document.getElementById("reset").addEventListener("click", resetOptions)
})


/****** LAYOUT *******/
function notify(t, c) {

	msg.textContent = t
	msg.classList.add(c)
	return t
}
function selectTab(e) {												//console.log(e.target.parentNode)
	
	e.target.parentNode.querySelector("[aria-selected]").removeAttribute("aria-selected")
	document.body.setAttribute("data-tab", e.target.tabTarget)
	e.target.setAttribute("aria-selected", true)
}
function getAllValues(sel) {
	
	let all	= []
		filter.querySelectorAll(sel + " li label").forEach(el => {
		all.push(el.textContent)
	})
	return all.sort().reverse()
}
function listFilters(oTab) {											//console.log(oTab, bg.opts.filters[oTab.id])
	
	let list = oTab.querySelector("ul")
	//Clear in case we already populated
	while (list.firstChild) { list.removeChild(list.firstChild); }
		
	bg.opts.filters[oTab.id].forEach(addFilter, list)
	if (list.childElementCount > 0) {
    	list.classList.remove("empty")
	} else {
    	list.classList.add("empty")
	}
}

function addFilterMan(e) {												//console.log(e.currentTarget.closest("#filter > div").querySelector("ul"))

	e.preventDefault()
	let v		= e.currentTarget.parentNode.querySelector("[type=text]").value
	let list	= e.currentTarget.closest("#filter > div").querySelector("ul")
	if (v.trim().length > 0) {
		let newNode = addFilter.call(list, v)
		newNode.classList.add("new")
		list.classList.remove("empty")
	}
	else {
		alert("Please enter something in the text box")
	}
}

function addFilter(t) {													//console.log(this,t)

    let listItem = document.createElement("li")	
    listItem.appendChild(document.importNode(template.content, true))
    listItem.querySelector("label").textContent = t
    listItem.querySelector("button").addEventListener("click", removeFilter)
    return this.insertBefore(listItem, this.firstChild)
}
function removeFilter(e) {

	let list	= e.target.closest("ul")
	e.target.parentNode.remove()
	if (list.childElementCount == 0) {
    	list.classList.add("empty")
	}
}

/****** OPTIONS *******/
function restoreOptions() {												//console.log("restoreOptions", bg.opts)
	
	document.getElementById("keyhigh").checked	= bg.opts.keyhigh
	for (let tab of oTabs)
		listFilters(tab)
	
}
function storeOptions(o) {												//console.log("storeOptions", o)

	return bg.optsStore(o)
		.then(storeSuccess, storeFail)
}
function storeSuccess() {												//console.log("storeSuccess")
	
	notify( "Options successfully saved.","success")
}
function storeFail(e) {
	
	bg.notify(notify(`Error while saving your options: ${e}`,"warning"),'error')
}
function saveOptions(e) {												//console.log("saveOptions")
	
	e.preventDefault();
	storeOptions({
		keyhigh: document.getElementById("keyhigh").checked,
		filters: {		
			xurl:	getAllValues("#xurl"),  //OR JUST ADD the new ones with class = new!!!!!!!!!!!!!!!!!!!
			xsub:	getAllValues("#xsub"),
			url:	getAllValues("#url"),
			sub:	getAllValues("#sub"),
			dom:	getAllValues("#dom"),
		} 
	})
}
function resetOptions(e) {												//console.log("resetOptions", bg.defaultOpts)
	
	e.preventDefault()
	if (!window.confirm("Are you sure you want to reset all options to default? You will lose all your settings!")) return
	storeOptions(bg.defaultOpts)
		.then(restoreOptions, null)		
}