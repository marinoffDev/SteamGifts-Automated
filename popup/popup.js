let gameIdsToScrape = [];

// Function to load game list and populate it in the popup
async function loadGameList() {
  const result = await chrome.storage.sync.get(['gameList']);
  const gameListElement = document.getElementById('gameList');
  gameListElement.innerHTML = ''; // Clear existing list

  if (result.gameList?.length > 0) {
    result.gameList.forEach(game => {
      const listItem = createGameListItem(game);
      gameListElement.appendChild(listItem);
      gameIdsToScrape.push(game.id); // Collect game IDs to scrape
    });
  } else {
    gameListElement.innerHTML = '<li>No games added yet.</li>';
  }
}

// Create game list item with remove button
function createGameListItem(game) {
  const listItem = document.createElement('li');

  const gameLink = document.createElement('a');
  gameLink.href = `https://www.steamgifts.com/${game.link}`;
  gameLink.textContent = game.name;
  gameLink.target = '_blank';

  const removeButton = createRemoveButton(game.id);
  listItem.appendChild(removeButton);
  listItem.appendChild(gameLink);

  return listItem;
}

// Create remove button for each game
function createRemoveButton(gameId) {
  const removeButton = document.createElement('button');
  removeButton.textContent = 'X';
  removeButton.classList.add('btn-danger');

  removeButton.addEventListener('click', () => {
    removeGameFromList(gameId);
  });

  return removeButton;
}

// Remove specific game from storage
async function removeGameFromList(gameId) {
  const result = await chrome.storage.sync.get(['gameList']);
  const updatedGameList = result.gameList.filter(game => game.id !== gameId);
  await chrome.storage.sync.set({ gameList: updatedGameList });
  loadGameList();
}

// Trigger giveaway entry process
async function triggerGiveawayEntry() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'enterGiveaways', gameIds: gameIdsToScrape });

  if (response?.status === 'success') {
    console.log('Giveaway entry process started.');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', loadGameList);

document.getElementById('enterAllBtn').addEventListener('click', triggerGiveawayEntry);
document.getElementById('clearListBtn').addEventListener('click', async () => {
  await chrome.storage.sync.remove('gameList');
  loadGameList();
});