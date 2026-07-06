import { gameStations } from './data/stations.js';
import { timelineData } from './data/timeline.js';
import { israelCities } from './data/cities.js';
import { charactersInfo } from './data/characters.js';
import { triviaQuestions } from './data/questions.js';
import { embedSpotifyTrack } from './services/spotify.js';
import { fetchVerse, fetchChapter } from './services/sefaria.js';
import { initLeafletMap, renderMapPins, updateHomeMarker, clearMapPins, highlightMarkerAndPan } from './map.js';

// Array shuffling utility
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Local State
let currentStationIndex = 0;
let score = 0;
let currentStationForChapter = null;
let isMuted = false;
let sessionQuestions = [];
let currentOptions = [];
let hasMadeMistake = false;

// DOM Elements
const clueTextElement = document.getElementById('clue-text');
const aiCreditElement = document.getElementById('ai-credit');
const clueContainer = document.getElementById('clue-container');
const scoreValueElement = document.getElementById('score-value');
const resultModal = document.getElementById('result-modal');
const closeModalBtn = document.getElementById('close-modal');
const nextBtn = document.getElementById('next-button');
const revealBtn = document.getElementById('reveal-btn');
const skipBtn = document.getElementById('skip-btn');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const loadingSpinner = document.getElementById('loading-spinner');
const clueButtonsContainer = document.querySelector('.clue-buttons');

const modalTitle = document.getElementById('modal-title');
const characterIcon = document.getElementById('character-icon');
const characterName = document.getElementById('character-name');
const characterDescription = document.getElementById('character-description');
const placeName = document.getElementById('place-name');
const verseText = document.getElementById('verse-text');
const verseRef = document.getElementById('verse-ref');
const secondarySourceContainer = document.getElementById('secondary-source-container');
const secondaryVerseText = document.getElementById('secondary-verse-text');
const secondaryVerseRef = document.getElementById('secondary-verse-ref');
const spotifyPlayerContainer = document.getElementById('spotify-player-container');

const openChapterBtn = document.getElementById('open-chapter-btn');
const fullChapterModal = document.getElementById('full-chapter-modal');
const closeChapterModal = document.getElementById('close-chapter-modal');
const chapterTitle = document.getElementById('chapter-title');
const audioRegular = document.getElementById('audio-regular');
const audioYemenite = document.getElementById('audio-yemenite');
const regularAudioContainer = document.getElementById('regular-audio-container');
const yemeniteAudioContainer = document.getElementById('yemenite-audio-container');
const fullChapterText = document.getElementById('full-chapter-text');

const successSound = document.getElementById('success-sound');
const errorSound = document.getElementById('error-sound');
const muteBtn = document.getElementById('mute-btn');

function initGame() {
    initLeafletMap();
    renderTimeline();
    initHomeSelector();
    
    closeModalBtn.addEventListener('click', hideModal);
    nextBtn.addEventListener('click', hideModal); // Next modal button just closes it now
    revealBtn.addEventListener('click', handleRevealAnswer);
    skipBtn.addEventListener('click', handleNextStation); // Main UI skip to next question
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', startGame);
    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
    }
}

async function startGame() {
    let questionsPool = [...triviaQuestions];
    shuffleArray(questionsPool);
    sessionQuestions = questionsPool.slice(0, 5);
    currentStationIndex = 0;
    score = 0;
    hasMadeMistake = false;
    scoreValueElement.textContent = `0 / 5`;
    
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    document.getElementById('clue-title').textContent = `מכין משחק...`;
    
    clueTextElement.classList.add('hidden');
    if (clueButtonsContainer) clueButtonsContainer.classList.add('hidden');
    if (aiCreditElement) aiCreditElement.classList.add('hidden');
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    
    loadCurrentStation();
}

function toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
        muteBtn.textContent = '🔇';
        muteBtn.title = 'הפעל צלילי עזר';
    } else {
        muteBtn.textContent = '🔊';
        muteBtn.title = 'השתק צלילי עזר';
    }
}

// Initialize Home Selector
function initHomeSelector() {
    const select = document.getElementById('home-city');
    if (!select) return;

    // Sort alphabetically
    israelCities.sort((a, b) => a.name.localeCompare(b.name, 'he'));

    israelCities.forEach(city => {
        const option = document.createElement('option');
        option.value = JSON.stringify(city.coords);
        option.textContent = city.name;
        select.appendChild(option);
    });

    select.addEventListener('change', handleHomeSelection);
}

function handleHomeSelection(event) {
    const val = event.target.value;
    if (!val) return;
    const coords = JSON.parse(val);
    updateHomeMarker(coords);
}

// Render Timeline
function renderTimeline() {
    const timelineContainer = document.getElementById('timeline-container');
    if (!timelineContainer) return;
    
    timelineContainer.innerHTML = '';
    
    const line = document.createElement('div');
    line.id = 'timeline-line';
    timelineContainer.appendChild(line);

    const minYear = timelineData[0].year;
    const maxYear = timelineData[timelineData.length - 1].year;
    const totalYears = maxYear - minYear;

    let lastLeftPct = -100;
    let lastRightPct = -100;
    const minGap = 4.0; // Percentage gap needed to avoid overlap

    timelineData.forEach((item) => {
        const padding = 2;
        const percentage = ((item.year - minYear) / totalYears) * (100 - 2 * padding) + padding;

        // Choose side: default left, but if overlaps with left, move to right
        let side = 'left';
        if (percentage - lastLeftPct < minGap) {
            side = 'right';
        }
        
        if (side === 'left') {
            lastLeftPct = percentage;
        } else {
            lastRightPct = percentage;
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = 'timeline-item';
        if (side === 'right') {
            itemDiv.classList.add('right-side');
        }
        itemDiv.style.top = `${percentage}%`;
        itemDiv.setAttribute('data-year', item.year);

        const dot = document.createElement('div');
        dot.className = 'timeline-dot';
        itemDiv.appendChild(dot);

        const boxDiv = document.createElement('div');
        boxDiv.className = 'timeline-content-box';
        
        let boxHTML = '';
        if (item.character) {
            boxHTML += `<div class="timeline-character">${item.character}</div>`;
        }
        if (item.event) {
            boxHTML += `<div class="timeline-event">${item.event}</div>`;
        }
        boxDiv.innerHTML = boxHTML;
        itemDiv.appendChild(boxDiv);
        
        timelineContainer.appendChild(itemDiv);
    });
}

async function loadCurrentStation() {
    if (currentStationIndex >= 5) {
        showEndScreen();
        return;
    }
    const question = sessionQuestions[currentStationIndex];
    document.getElementById('clue-title').textContent = `שאלה ${currentStationIndex + 1} מתוך 5:`;
    if (aiCreditElement) aiCreditElement.classList.add('hidden');
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    
    const correctStation = gameStations.find(s => s.id === question.correct_answer);
    if (!correctStation) {
        console.error("Correct station not found for:", question.correct_answer);
        return;
    }
    
    clueTextElement.classList.remove('hidden');
    if (clueButtonsContainer) clueButtonsContainer.classList.remove('hidden');
    
    hasMadeMistake = false; // reset for this question
    
    const options = [correctStation];
    const shuffledDistractors = [...question.distractors];
    shuffleArray(shuffledDistractors);
    const selectedDistractors = shuffledDistractors.slice(0, 3);
    
    const distractorsObj = selectedDistractors.map(dId => gameStations.find(s => s.id === dId)).filter(Boolean);
    options.push(...distractorsObj);
    shuffleArray(options);
    currentOptions = options;
    
    renderMapPins(currentOptions, handlePinClick);
    
    clueTextElement.textContent = question.question || question.question_text || "שגיאה בטעינת השאלה.";
    
    let categoryEl = document.getElementById('clue-category');
    if (!categoryEl) {
        categoryEl = document.createElement('div');
        categoryEl.id = 'clue-category';
        categoryEl.className = 'clue-category';
        clueTextElement.parentNode.insertBefore(categoryEl, clueTextElement);
    }
    categoryEl.textContent = `קטגוריה: ${question.category}`;
    categoryEl.classList.remove('hidden');
    
    renderOptionsUI();
}

function renderOptionsUI() {
    let optionsContainer = document.getElementById('options-container');
    if (!optionsContainer) {
        optionsContainer = document.createElement('div');
        optionsContainer.id = 'options-container';
        optionsContainer.className = 'options-container';
        clueTextElement.parentNode.insertBefore(optionsContainer, clueTextElement.nextSibling);
    }
    optionsContainer.innerHTML = '';
    
    currentOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-button';
        btn.textContent = opt.placeNameHebrew;
        btn.addEventListener('click', () => handlePinClick(opt.id));
        optionsContainer.appendChild(btn);
    });
}

function showEndScreen() {
    gameScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    clearMapPins();
    
    const endText = document.getElementById('end-text');
    if (score === 5) {
        endText.textContent = `מושלם! כל הכבוד! 🏆 (ציון: 5/5)`;
    } else if (score >= 3) {
        endText.textContent = `יפה מאוד! שליטה מרשימה! ⭐ (ציון: ${score}/5)`;
    } else {
        endText.textContent = `טעון שיפור... אפשר לנסות שוב! 💪 (ציון: ${score}/5)`;
    }
}

async function handlePinClick(clickedId) {
    if (currentStationIndex >= 5) return;
    
    const question = sessionQuestions[currentStationIndex];
    const correctStation = gameStations.find(s => s.id === question.correct_answer);
    
    if (clickedId === correctStation.id) {
        handleCorrectAnswer(correctStation);
    } else {
        handleIncorrectAnswer();
    }
}

function handleIncorrectAnswer() {
    hasMadeMistake = true;
    if (!isMuted) {
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log("Audio play blocked"));
    }
    
    clueContainer.classList.remove('shake');
    void clueContainer.offsetWidth; // trigger reflow
    clueContainer.classList.add('shake');
}

function handleRevealAnswer() {
    hasMadeMistake = true;
    if (currentStationIndex >= 5) return;
    const question = sessionQuestions[currentStationIndex];
    const correctStation = gameStations.find(s => s.id === question.correct_answer);
    if (correctStation) {
        highlightMarkerAndPan(correctStation.id, correctStation.coordinates);
    }
}

async function handleCorrectAnswer(station) {
    if (!hasMadeMistake) {
        score += 1;
    }
    scoreValueElement.textContent = `${score} / 5`;
    currentStationForChapter = station;
    
    if (!isMuted) {
        successSound.currentTime = 0;
        successSound.play().catch(e => console.log("Audio play blocked"));
    }
    
    modalTitle.textContent = "כל הכבוד!";
    
    // Character Info
    if (station.characterName) {
        characterIcon.textContent = station.characterIcon || "👤";
        characterName.textContent = station.characterName;
        characterDescription.textContent = charactersInfo[station.characterName] || "";
        characterIcon.style.display = 'block';
    } else {
        characterIcon.style.display = 'none';
        characterName.textContent = "";
        characterDescription.textContent = "";
    }

    placeName.textContent = station.placeNameHebrew || station.id;
    
    // Verse Data
    const primarySourceContainer = document.querySelector('.primary-source');
    if (station.verseReference && station.sefariaApiUrl) {
        primarySourceContainer.classList.remove('hidden');
        verseRef.textContent = station.verseReference;
        verseText.textContent = "טוען פסוק מספרייה...";
    } else {
        primarySourceContainer.classList.add('hidden');
    }
    
    resultModal.classList.remove('hidden');
    
    // Timeline Highlight Logic
    document.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('active-timeline'));
    if (station.timelineYear) {
        const activeTimelineItem = document.querySelector(`.timeline-item[data-year="${station.timelineYear}"]`);
        if (activeTimelineItem) {
            activeTimelineItem.classList.add('active-timeline');
            const timelineContainer = document.getElementById('timeline-container');
            if (timelineContainer && timelineContainer.parentElement) {
                activeTimelineItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', block: 'center' });
            }
        }
    }
    
    // Spotify integration
    const query = station.spotifyQuery || station.characterName;
    if (query) {
        spotifyPlayerContainer.style.display = 'block';
        embedSpotifyTrack(query, spotifyPlayerContainer);
    } else {
        spotifyPlayerContainer.style.display = 'none';
        spotifyPlayerContainer.innerHTML = '';
    }
    
    // Primary Verse Fetch
    if (station.sefariaApiUrl) {
        const primaryText = await fetchVerse(station.sefariaApiUrl);
        verseText.textContent = primaryText ? primaryText : "לא הצלחנו לטעון את הפסוק.";
    }
    
    // Secondary Verse
    if (station.secondarySefariaApiUrl) {
        secondarySourceContainer.classList.remove('hidden');
        secondaryVerseRef.textContent = station.secondaryVerseReference;
        secondaryVerseText.textContent = "טוען פסוק נוסף...";
        
        const secText = await fetchVerse(station.secondarySefariaApiUrl);
        secondaryVerseText.textContent = secText ? secText : "לא הצלחנו לטעון את הפסוק.";
    } else {
        if (secondarySourceContainer) {
            secondarySourceContainer.classList.add('hidden');
        }
    }
}

// Full Chapter Modal Logic
if (openChapterBtn) {
    openChapterBtn.addEventListener('click', async () => {
        if (!currentStationForChapter || !currentStationForChapter.fullChapterSefariaRef) return;
        
        fullChapterModal.classList.remove('hidden');
        chapterTitle.textContent = "טוען פרק...";
        fullChapterText.innerHTML = "<p>טוען נתונים מספרייה...</p>";
        
        // Set Audio
        if (currentStationForChapter.audioRegular) {
            regularAudioContainer.classList.remove('hidden');
            audioRegular.src = currentStationForChapter.audioRegular;
            audioRegular.load();
        } else {
            regularAudioContainer.classList.add('hidden');
            audioRegular.src = "";
        }
        
        if (currentStationForChapter.audioYemenite) {
            yemeniteAudioContainer.classList.remove('hidden');
            audioYemenite.src = currentStationForChapter.audioYemenite;
            audioYemenite.load();
        } else {
            yemeniteAudioContainer.classList.add('hidden');
            audioYemenite.src = "";
        }
        
        // Fetch Text
        const chapterData = await fetchChapter(currentStationForChapter.fullChapterSefariaRef);
        chapterTitle.textContent = chapterData.title;
        fullChapterText.innerHTML = chapterData.html;
    });
}

if (closeChapterModal) {
    closeChapterModal.addEventListener('click', () => {
        fullChapterModal.classList.add('hidden');
        audioRegular.pause();
        audioYemenite.pause();
    });
}

function hideModal() {
    resultModal.classList.add('hidden');
}

function handleNextStation() {
    hideModal();
    currentStationIndex++;
    loadCurrentStation();
}

document.addEventListener('DOMContentLoaded', initGame);
