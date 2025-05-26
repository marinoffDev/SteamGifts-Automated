let gameIdsToScrape = [];

async function loadGameList() {
  const result = await chrome.storage.local.get(['gameList']);
  const gameListElement = document.getElementById('gameList');
  gameListElement.innerHTML = '';

  if (result.gameList?.length > 0) {
    result.gameList.forEach(game => {
      const listItem = createGameListItem(game);
      gameListElement.appendChild(listItem);
      gameIdsToScrape.push(game.id);
    });
  } else {
    gameListElement.innerHTML = '<li>No games added yet.</li>';
  }
}

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

function createRemoveButton(gameId) {
  const removeButton = document.createElement('button');
  removeButton.textContent = 'X';
  removeButton.classList.add('btn-secondary');
  removeButton.addEventListener('click', () => {
    removeGameFromList(gameId);
  });

  return removeButton;
}

async function removeGameFromList(gameId) {
  const result = await chrome.storage.local.get(['gameList']);
  const updatedGameList = result.gameList.filter(game => game.id !== gameId);
  await chrome.storage.local.set({ gameList: updatedGameList });
  loadGameList();
}

async function triggerGiveawayEntry() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'enterGiveaways', gameIds: gameIdsToScrape });

  if (response?.status === 'success') {
    console.log('Giveaway entry process started.');
  }
}

async function exportGameList() {
  const result = await chrome.storage.local.get(['gameList']);
  const gameList = result.gameList || [];

  if (gameList.length === 0) {
    alert('No games to export.');
    return;
  }

  const gameListJson = JSON.stringify(gameList, null, 2);
  const blob = new Blob([gameListJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gameList.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function importGameList(event) {
  const file = event.target.files[0];

  if (!file) {
    alert('No file selected.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const importedGameList = JSON.parse(e.target.result);

      if (!Array.isArray(importedGameList) || !importedGameList.every(game => game.id && game.name && game.link)) {
        alert('Invalid file format. Please upload a valid gameList.json file.');
        return;
      }

      await chrome.storage.local.set({ gameList: importedGameList });
      loadGameList();
      alert('Game list imported successfully!');
    } catch (error) {
      console.error('Error importing game list:', error);
      alert('Failed to import game list. Please ensure the file is valid.');
    }
  };
  reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', loadGameList);
document.getElementById('enterAllBtn').addEventListener('click', triggerGiveawayEntry);
document.getElementById('clearListBtn').addEventListener('click', async () => {
  const confirmation = confirm("Are you sure you want to delete your current games list?");
  if (confirmation) {
    await chrome.storage.local.remove('gameList');
    loadGameList(); 
  }
});
document.getElementById('exportBtn').addEventListener('click', exportGameList);
document.getElementById('importInput').addEventListener('change', importGameList);