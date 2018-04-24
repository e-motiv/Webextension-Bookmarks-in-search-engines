let myTab, filters,
	portBG 	= browser.runtime.connect(),
	bg	= browser.extension.getBackgroundPage()


portBG.onMessage.addListener( (m) => {								//console.log("Messsage from BG received:",m)

	let fn = this[m.fn]	
	if (typeof fn === "function") fn(m)
	else console.error(m.fn + " is not a function", m, typeof fn)
})

document.addEventListener("DOMContentLoaded", () => {				//console.log("Domloaded")
	
	filters = document.querySelectorAll("[role=switch]")
	
	browser.tabs.query({active: true, lastFocusedWindow: true}, tabs =>
	{																//console.log(tabs)
		tab = tabs[0]
		//If addon loaded while tab open reInit Tab variables
		if (!bg.myTabs.has(tab.id)) {								//console.log("tab not intialized")
			myTab = bg.tabInit(tab)
		} else
			myTab = bg.myTabs.get(tab.id)
			
		updateFilters()
	})

	for (el of filters) {
		el.addEventListener("click", toggleFilter)
	}
	document.getElementById("report").addEventListener("click", reportIssue)
	document.getElementById("options").addEventListener("click", () => {
		browser.runtime.openOptionsPage()
		window.close()
	})
})
function styleFilter(el, c) {										//console.log(`styleFilter`, el,c)

	el.classList.remove("yes", "no", "unset")
	el.classList.add(c)
}

function updateFilters() {											//console.log(`updateFilters`,filters, myTab, bg.opts)
	for (el of filters) {
		let cls = null
		if (myTab.filters)
			switch (myTab.filters[el.dataset.ftype]) {
				case true:
					cls="yes"
					break
				case false:
					cls="no"
					break
		}
	if (!cls)
		cls = "unset"
	styleFilter(el, cls)
	}
}

function toggleFilter(e) {									//console.log("toggleFilter (current)",e.currentTarget.dataset.ftyp, e.currentTarget.classList)
	
	let v = e.currentTarget.classList[0]
	switch (v) {
		case "yes":
			v = "no"
			break;
		case "no":
			v = "unset"
			break
		default:
			v = "yes"
	}
	myTab.filterSet(e.currentTarget.dataset.ftype, v)
	//portBG.postMessage({fn: "filterSet", fType:e.currentTarget.dataset.ftype, value: v, tabId: tab.id})
}

function reportIssue()
{
	browser.tabs.create({
		url: browser.runtime.getURL("https://github.com/e-motiv/Webextension-Bookmarks-in-search-engines/issues/new")
	}).then(() => {
		window.close()
	})
}
