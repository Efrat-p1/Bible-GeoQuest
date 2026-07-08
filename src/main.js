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
let isExploring = false;
let isQuestionAnswered = false;

// DOM Elements
const clueTextElement = document.getElementById('clue-text');
const aiCreditElement = document.getElementById('ai-credit');
const clueContainer = document.getElementById('clue-container');
const scoreValueElement = document.getElementById('score-value');
const resultModal = document.getElementById('result-modal');
const closeModalBtn = document.getElementById('close-modal');
const nextBtn = document.getElementById('next-button');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const loadingSpinner = document.getElementById('loading-spinner');

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
    
    closeModalBtn.addEventListener('click', handleModalClose);
    nextBtn.addEventListener('click', handleModalClose);
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', startGame);
    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
    }
    const showAllBtn = document.getElementById('show-all-btn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', toggleExploreMode);
    }
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.addEventListener('click', nextQuestion);
    }
}

function nextQuestion() {
    currentStationIndex++;
    loadCurrentStation();
}

function toggleExploreMode() {
    const showAllBtn = document.getElementById('show-all-btn');
    if (isExploring) {
        isExploring = false;
        if (showAllBtn) showAllBtn.innerHTML = "מפת כל המקומות 🗺️";
        
        if (sessionQuestions.length === 0) {
            startScreen.classList.remove('hidden');
            clueTextElement.classList.add('hidden');
            document.getElementById('clue-title').textContent = "";
            clearMapPins();
        } else if (currentStationIndex >= 5) {
            showEndScreen();
        } else {
            gameScreen.classList.remove('hidden');
            renderMapPins(currentOptions, handlePinClick);
        }
    } else {
        isExploring = true;
        if (showAllBtn) showAllBtn.innerHTML = "חזור למשחק ↩️";
        
        startScreen.classList.add('hidden');
        endScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        
        clueTextElement.textContent = "מציג את כל המקומות התנ\"כיים על המפה 🗺️";
        clueTextElement.classList.remove('hidden');
        
        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer) optionsContainer.innerHTML = '';
        const categoryEl = document.getElementById('clue-category');
        if (categoryEl) categoryEl.classList.add('hidden');
        
        document.getElementById('clue-title').textContent = "כל המקומות";
        
        renderMapPins(gameStations, handlePinClick);
    }
}

async function startGame() {
    let questionsPool = [...triviaQuestions];
    shuffleArray(questionsPool);
    sessionQuestions = questionsPool.slice(0, 5);
    currentStationIndex = 0;
    score = 0;
    hasMadeMistake = false;
    isExploring = false;
    isQuestionAnswered = false;
    scoreValueElement.textContent = `0 / 5`;
    
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    document.getElementById('clue-title').textContent = `מכין משחק...`;
    
    clueTextElement.classList.add('hidden');
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

    let currentWeight = 0;
    const itemsInfo = [];
    
    // First pass: calculate weights
    timelineData.forEach((item, index) => {
        let weight = 0;
        let hasGap = false;
        
        if (index > 0) {
            const deltaYear = item.year - timelineData[index - 1].year;
            if (deltaYear > 150) {
                weight = 10;
                hasGap = true;
            } else {
                weight = Math.max(4, deltaYear / 10);
            }
        }
        
        currentWeight += weight;
        itemsInfo.push({
            ...item,
            accumulatedWeight: currentWeight,
            hasGapBefore: hasGap
        });
    });

    const totalWeight = currentWeight;
    const padding = 2; // %

    let lastLeftPct = -100;
    let lastRightPct = -100;
    const minVisualGap = 2.5; 

    itemsInfo.forEach((item, index) => {
        const percentage = totalWeight > 0 
            ? (item.accumulatedWeight / totalWeight) * (100 - 2 * padding) + padding
            : 50;

        if (item.hasGapBefore) {
            const prevItem = itemsInfo[index - 1];
            const prevPercentage = (prevItem.accumulatedWeight / totalWeight) * (100 - 2 * padding) + padding;
            const midPercentage = (percentage + prevPercentage) / 2;
            
            const gapDiv = document.createElement('div');
            gapDiv.className = 'timeline-dots-gap';
            gapDiv.innerHTML = '⋮<br>⋮';
            gapDiv.style.top = `${midPercentage}%`;
            timelineContainer.appendChild(gapDiv);
        }

        // Choose side: strictly alternate to maximize space for larger fonts
        let side = (index % 2 === 0) ? 'left' : 'right';
        
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
    
    hasMadeMistake = false; // reset for this question
    isQuestionAnswered = false;
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) nextQuestionBtn.classList.add('hidden');
    
    const options = [correctStation];
    const shuffledDistractors = [...question.distractors];
    shuffleArray(shuffledDistractors);
    const selectedDistractors = shuffledDistractors.slice(0, 3);
    
    const distractorsObj = selectedDistractors.map(d => {
        const id = typeof d === 'string' ? d : d.id;
        return gameStations.find(s => s.id === id);
    }).filter(Boolean);
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
    if (isExploring) {
        const station = gameStations.find(s => s.id === clickedId);
        if (station) {
            handleCorrectAnswer(station);
        }
        return;
    }

    if (currentStationIndex >= 5) return;
    
    const question = sessionQuestions[currentStationIndex];
    const correctStation = gameStations.find(s => s.id === question.correct_answer);
    
    if (isQuestionAnswered) {
        if (clickedId === correctStation.id) {
            handleCorrectAnswer(correctStation);
        }
        return;
    }

    if (clickedId === correctStation.id) {
        handleCorrectAnswer(correctStation);
    } else {
        handleIncorrectAnswer();
    }
}

function handleIncorrectAnswer() {
    hasMadeMistake = true;
    if (!isMuted && !isQuestionAnswered) {
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log("Audio play blocked"));
    }
    
    const question = sessionQuestions[currentStationIndex];
    const correctStation = gameStations.find(s => s.id === question.correct_answer);
    
    if (correctStation) {
        handleCorrectAnswer(correctStation);
    }
}


async function handleCorrectAnswer(station) {
    const wasCorrect = !hasMadeMistake && !isExploring;
    if (wasCorrect && !isQuestionAnswered) {
        score += 1;
    }
    if (!isExploring) {
        scoreValueElement.textContent = `${score} / 5`;
    }
    currentStationForChapter = station;
    
    if (!isMuted && wasCorrect && !isQuestionAnswered) {
        successSound.currentTime = 0;
        successSound.play().catch(e => console.log("Audio play blocked"));
    }
    
    if (isExploring) {
        modalTitle.textContent = "מידע על המקום";
        nextBtn.textContent = "חזור למפה 🗺️";
    } else if (wasCorrect) {
        modalTitle.textContent = "תשובה נכונה!";
        nextBtn.textContent = "סגור וחזור למפה 🗺️";
    } else {
        modalTitle.textContent = "טעית! התשובה הנכונה:";
        nextBtn.textContent = "סגור וחזור למפה 🗺️";
    }

    if (!isExploring) {
        isQuestionAnswered = true;
        const nextQuestionBtn = document.getElementById('next-question-btn');
        if (nextQuestionBtn) nextQuestionBtn.classList.remove('hidden');
    }
    
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

    placeName.textContent = "📍 " + (station.placeNameHebrew || station.id);
    
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

function handleModalClose() {
    resultModal.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', initGame);
