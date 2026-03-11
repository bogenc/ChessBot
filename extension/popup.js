document.getElementById('green-pawn').addEventListener('click', () => {
  alert("Green pawn icon by Icon8")
})


document.addEventListener('DOMContentLoaded', () => {

  // ── Stance Picker ──
  const stancePicker = document.getElementById('stance-picker');

  chrome.storage.local.get(['stance'], (result) => {
    const saved = result.stance !== undefined ? result.stance : 1; // Default: Neutral
    stancePicker.dataset.selected = saved;
  });

  document.querySelectorAll('.stance-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = btn.dataset.index;
      stancePicker.dataset.selected = index;
      chrome.storage.local.set({ stance: index }, () => {
        console.log(`Stance saved: ${index}`);
      });
    });
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
  // Accurate linearly scaling depth-elo estimation, backed by
  //  - https://web.ist.utl.pt/diogo.ferreira/papers/ferreira13impact.pdf
  //  - Independent testers measuring Stockfish depth: 40 at 3400
  //  - Independent testers measuring Stockfish depth: 1 at 1400

  const stockfishDepthElo = [
    { "depth": 1, "elo": 1400 },
    { "depth": 2, "elo": 1480 },
    { "depth": 3, "elo": 1560 },
    { "depth": 4, "elo": 1640 },
    { "depth": 5, "elo": 1720 },
    { "depth": 6, "elo": 1800 },
    { "depth": 7, "elo": 1880 },
    { "depth": 8, "elo": 1960 },
    { "depth": 9, "elo": 2040 },
    { "depth": 10, "elo": 2120 },
    { "depth": 11, "elo": 2200 },
    { "depth": 12, "elo": 2280 },
    { "depth": 13, "elo": 2360 },
    { "depth": 14, "elo": 2440 },
    { "depth": 15, "elo": 2520 },
    { "depth": 16, "elo": 2600 },
    { "depth": 17, "elo": 2680 },
    { "depth": 18, "elo": 2760 },
    { "depth": 19, "elo": 2840 },
    { "depth": 20, "elo": 2900 },
    { "depth": 21, "elo": 2925 },
    { "depth": 22, "elo": 2950 },
    { "depth": 23, "elo": 2975 },
    { "depth": 24, "elo": 3000 },
    { "depth": 25, "elo": 3025 },
    { "depth": 26, "elo": 3050 },
    { "depth": 27, "elo": 3075 },
    { "depth": 28, "elo": 3100 },
    { "depth": 29, "elo": 3125 },
    { "depth": 30, "elo": 3150 },
    { "depth": 31, "elo": 3175 },
    { "depth": 32, "elo": 3200 },
    { "depth": 33, "elo": 3225 },
    { "depth": 34, "elo": 3250 },
    { "depth": 35, "elo": 3275 },
    { "depth": 36, "elo": 3300 },
    { "depth": 37, "elo": 3325 },
    { "depth": 38, "elo": 3350 },
    { "depth": 39, "elo": 3375 },
    { "depth": 40, "elo": 3400 }
  ]

  // Find the depth object in the array
  const result = stockfishDepthElo.find(entry => entry.depth === parseInt(depth));

  // Return ELO if found, otherwise return a fallback message

  //console.log(result)

  document.getElementById("elo").innerText = `Engine ELO: ${result.elo}`;
  return result ? result.elo : `Depth ${depth} not found in the dataset.`;
}

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

          let args = {
            'depth': document.getElementById("elo-range").value,
            'stance': document.getElementById("stance-picker").dataset.selected
          }

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