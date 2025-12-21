function fadeInAndOut() {
  const element = document.getElementById('icons8');

  // Fade in the element
  element.style.opacity = 1;

  // After 8 seconds, fade out the element
  setTimeout(() => {
      element.style.opacity = 0;
  }, 8000);
}

document.getElementById('green-pawn').addEventListener('click', () => {
  fadeInAndOut()
})


document.getElementById('inject').addEventListener('change', () => {
  const isChecked = event.target.checked;

  // Save the checkbox state in chrome.storage
  chrome.storage.local.set({ isChecked }, () => {
    console.log(`Checkbox state saved: ${isChecked}`);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['isChecked'], (result) => {
    const checkbox = document.getElementById('inject');
    if (checkbox.checked != result.isChecked) {
      checkbox.checked = result.isChecked || false; // Default to false if not set
      const event = new Event('change');
      checkbox.dispatchEvent(event);
    }
  });

  chrome.storage.local.get(['depth'], (result) => {
    //console.log(`fetched elo-range as ${result.depth}`)
    const range = document.getElementById('elo-range');
    if (range.value != result.depth) {
      range.value = result.depth || 20; // Default to 20 if not set
      const event = new Event('input');
      range.dispatchEvent(event);
    }
  });

});

function getEloFromDepth(depth) {
  //console.log(`Getelofromdepth has depth ${depth}`)
  const stockfishDepthElo = [
    { depth: 2, elo: 1000 },
    { depth: 3, elo: 1200 },
    { depth: 4, elo: 1400 },
    { depth: 5, elo: 1500 },
    { depth: 6, elo: 1600 },
    { depth: 7, elo: 1700 },
    { depth: 8, elo: 1800 },
    { depth: 9, elo: 1900 },
    { depth: 10, elo: 2000 },
    { depth: 11, elo: 2100 },
    { depth: 12, elo: 2200 },
    { depth: 13, elo: 2300 },
    { depth: 14, elo: 2400 },
    { depth: 15, elo: 2450 },
    { depth: 16, elo: 2500 },
    { depth: 17, elo: 2550 },
    { depth: 18, elo: 2600 },
    { depth: 19, elo: 2650 },
    { depth: 20, elo: 2700 },
    { depth: 21, elo: 2750 },
    { depth: 22, elo: 2800 },
    { depth: 23, elo: 2850 },
    { depth: 24, elo: 2900 },
    { depth: 25, elo: 2950 },
    { depth: 26, elo: 3000 },
    { depth: 27, elo: 3050 },
    { depth: 28, elo: 3100 },
    { depth: 29, elo: 3150 },
    { depth: 30, elo: 3200 },
    { depth: 31, elo: 3250 },
    { depth: 32, elo: 3300 },
    { depth: 33, elo: 3350 },
    { depth: 34, elo: 3400 },
    { depth: 35, elo: 3450 },
    { depth: 36, elo: 3500 },
    { depth: 37, elo: 3550 },
    { depth: 38, elo: 3600 },
    { depth: 39, elo: 3650 },
    { depth: 40, elo: 3700 }
  ];

  // Find the depth object in the array
  const result = stockfishDepthElo.find(entry => entry.depth === parseInt(depth));

  // Return ELO if found, otherwise return a fallback message

  //console.log(result)

  document.getElementById("elo").innerText = `ELO: ${result.elo}`;
  return result ? result.elo : `Depth ${depth} not found in the dataset.`;
}


document.getElementById("inject").addEventListener("change", (event) => {
  document.getElementById("scan-start").disabled = !event.target.checked;
});


document.getElementById("elo-range").addEventListener("input", (event) => {


  //console.log("Input value changed to:", event.target.value);
  getEloFromDepth(event.target.value)

});


document.getElementById("elo-range").addEventListener("change", (event) => {
  
  let depth = event.target.value;

  chrome.storage.local.set({ depth }, () => {
    console.log(`Elo range state saved: ${depth}`);
  });
})



document.getElementById("scan-start").addEventListener("click", () => {
  // Query the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];  // Get the active tab
      const url = tab.url;

      // Check if the tab's URL matches the chess.com pattern
      if (url && url.includes("chess.com")) {
          // Inject engine.js if the URL matches

          let args = {'depth': document.getElementById("elo-range").value}

          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: function(args) {
                window.args = args;  // Assign the arguments to the global window object
            },
            args: [args]
        });


chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['engine.js']
});




      } else {
          // Optionally, alert the user if the tab is not a chess.com page
          alert("This is not a chess.com page.");
      }
  });
});
