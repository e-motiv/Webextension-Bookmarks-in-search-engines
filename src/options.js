let msg
function saveOptions(e) {
	
	e.preventDefault();
	browser.storage.local.set({keyhigh : document.getElementById("keyhigh").checked})
		.then(
			() => {										//console.log(document.getElementById("keyhigh"))
				msg.textContent = "Options successfully saved."
			}, 
			error => {
				console.error(`Error: ${error}`)
				msg.textContent = `Error while saving your options: ${error}`
			}
		)
}

function restoreOptions() {

	msg = document.getElementById("msg")

	browser.storage.local.get("keyhigh")
		.then(
			result => {									//console.log(result)
				//Default
				if (result.keyhigh === undefined) result.keyhigh = true
				document.getElementById("keyhigh").checked = result.keyhigh
			}, 
			error => {
				console.error(`Error: ${error}`)
				msg.textContent = `Error while getting your options: ${error}`
			}
		)
}

document.addEventListener("DOMContentLoaded", restoreOptions)
document.querySelector("form").addEventListener("submit", saveOptions)