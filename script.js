// =============================================
// Memorama de Profesiones y Oficios
// Lógica principal del juego
// =============================================

// Catálogo de 10 profesiones representadas con emojis
const allProfessions = [
    { name: 'Astronauta',  content: '👩‍🚀' },
    { name: 'Bombero',     content: '👨‍🚒' },
    { name: 'Doctora',     content: '👩‍⚕️' },
    { name: 'Pintor',      content: '👨‍🎨' },
    { name: 'Científica',  content: '👩‍🔬' },
    { name: 'Policía',     content: '👮'   },
    { name: 'Cocinero',    content: '👨‍🍳' },
    { name: 'Profesor',    content: '👨‍🏫' },
    { name: 'Detective',   content: '🕵️'  },
    { name: 'Músico',      content: '👨‍🎤' }
];

// Configuración de los tres niveles de dificultad
const difficultyConfig = {
    easy:   { pairs: 3,  cols: 3 },   // 6 tarjetas  — Fácil
    medium: { pairs: 6,  cols: 4 },   // 12 tarjetas — Medio
    hard:   { pairs: 10, cols: 5 }    // 20 tarjetas — Difícil
};

// Estado del juego
let cards          = [];
let flippedCards   = [];
let matchedPairs   = 0;
let isBoardLocked  = false;
let currentDifficulty = 'medium';

// Referencias al DOM
const board              = document.getElementById('game-board');
const resetBtn           = document.getElementById('reset-btn');
const modal              = document.getElementById('modal');
const modalTitle         = document.getElementById('modal-title');
const modalMessage       = document.getElementById('modal-message');
const playAgainBtn       = document.getElementById('play-again-btn');
const nextLevelBtn       = document.getElementById('next-level-btn');
const confettiContainer  = document.getElementById('confetti');

// =============================================
// AUDIO — Web Audio API (sin archivos externos)
// =============================================
class AudioSynth {
    constructor() { this.ctx = null; }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Pop suave al voltear una carta
    playPop() {
        try {
            this.init();
            const osc  = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(350, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        } catch(e) {}
    }

    // Fanfarria triunfal al encontrar pareja
    playSuccess() {
        try {
            this.init();
            const now = this.ctx.currentTime;
            const tone = (freq, start, dur) => {
                const osc  = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.12, start);
                gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
                osc.start(start);
                osc.stop(start + dur);
            };
            tone(523.25,  now,        0.12); // Do5
            tone(659.25,  now + 0.08, 0.12); // Mi5
            tone(783.99,  now + 0.16, 0.12); // Sol5
            tone(1046.50, now + 0.24, 0.20); // Do6
        } catch(e) {}
    }

    // Sonido descendente tierno al no coincidir
    playError() {
        try {
            this.init();
            const now = this.ctx.currentTime;
            const tone = (freq, start, dur) => {
                const osc  = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, start);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.85, start + dur);
                gain.gain.setValueAtTime(0.15, start);
                gain.gain.linearRampToValueAtTime(0.01, start + dur);
                osc.start(start);
                osc.stop(start + dur);
            };
            tone(220, now,        0.15);
            tone(165, now + 0.18, 0.22);
        } catch(e) {}
    }
}

const soundSynth = new AudioSynth();

// =============================================
// VOZ — Web Speech API (síntesis en español)
// =============================================
let speechVoice = null;

function initSpeech() {
    if (!('speechSynthesis' in window)) return;

    const selectVoice = () => {
        const voices        = window.speechSynthesis.getVoices();
        const spanishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('es'));

        const femaleKeywords = [
            'paulina','monica','helena','sabina','google español',
            'google us spanish','soledad','angelica','elena','sara',
            'luz','maria','paola','daria','conchita','francesca',
            'sandra','carmen','elsa','zira','female'
        ];

        speechVoice = null;
        for (const kw of femaleKeywords) {
            const found = spanishVoices.find(v => {
                const n = v.name.toLowerCase();
                return n.includes(kw) &&
                    !n.includes('david') && !n.includes('jorge') &&
                    !n.includes('pablo') && !n.includes('julio') &&
                    !n.includes('enrique') && !n.includes('male');
            });
            if (found) { speechVoice = found; break; }
        }

        if (!speechVoice) {
            speechVoice = spanishVoices.find(v => {
                const n = v.name.toLowerCase();
                return !n.includes('david') && !n.includes('jorge') && !n.includes('male');
            }) || spanishVoices[0] || null;
        }
    };

    selectVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = selectVoice;
    }
}

function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);

    if (speechVoice) {
        utt.voice = speechVoice;
        utt.lang  = speechVoice.lang;
    } else {
        utt.lang = 'es-MX';
    }

    const isPremium = speechVoice && ['paulina','helena','monica','sabina']
        .some(kw => speechVoice.name.toLowerCase().includes(kw));

    utt.pitch = isPremium ? 1.15 : 1.25;
    utt.rate  = 0.95;
    window.speechSynthesis.speak(utt);
}

initSpeech();

// =============================================
// LÓGICA DEL JUEGO
// =============================================

/** Actualiza el botón activo en la barra de dificultad */
function syncDifficultyBar(level) {
    document.querySelectorAll('.btn-diff').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === level);
    });
}

/** Cambia el nivel, actualiza la barra y reinicia el tablero */
function setDifficulty(level) {
    currentDifficulty = level;
    syncDifficultyBar(level);
    const names = { easy: 'fácil', medium: 'medio', hard: 'difícil' };
    speak(`Cambiando al nivel ${names[level]}. Reorganizando tarjetas.`);
    initGame();
}

/** Inicializa o reinicia el juego con el nivel actual */
function initGame() {
    board.innerHTML            = '';
    flippedCards               = [];
    matchedPairs               = 0;
    isBoardLocked              = false;
    confettiContainer.innerHTML = '';
    modal.classList.add('hidden');

    const config   = difficultyConfig[currentDifficulty];
    const selected = allProfessions.slice(0, config.pairs);
    cards = [...selected, ...selected].sort(() => Math.random() - 0.5);

    board.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

    cards.forEach((prof, index) => {
        const el = document.createElement('div');
        el.classList.add('card');
        el.dataset.index = index;
        el.dataset.name  = prof.name;
        el.innerHTML = `
            <div class="card-face card-back"></div>
            <div class="card-face card-front">
                <div class="emoji-content">${prof.content}</div>
                <span>${prof.name}</span>
            </div>`;
        el.addEventListener('click', flipCard);
        board.appendChild(el);
    });

    const labels = { easy: 'fácil', medium: 'medio', hard: 'difícil' };
    speak(`¡Encuentra las parejas de profesiones! Nivel ${labels[currentDifficulty]}.`);
}

/** Voltea una carta al hacer clic */
function flipCard() {
    if (isBoardLocked) return;
    if (this.classList.contains('flipped') || this.classList.contains('matched')) return;

    soundSynth.init();
    soundSynth.playPop();
    this.classList.add('flipped');
    flippedCards.push(this);

    // Solo pronunciar al voltear la primera carta
    if (flippedCards.length === 1) {
        speak(this.dataset.name);
    }

    if (flippedCards.length === 2) {
        isBoardLocked = true; // bloquear mientras se evalúa
        checkMatch();
    }
}

/** Verifica si las dos cartas volteadas forman pareja */
function checkMatch() {
    const [c1, c2] = flippedCards;

    if (c1.dataset.name === c2.dataset.name) {
        // ✅ Pareja encontrada
        c1.classList.add('matched');
        c2.classList.add('matched');
        matchedPairs++;
        flippedCards = [];

        soundSynth.playSuccess();
        setTimeout(() => speak(`¡Muy bien! Encontraste: ${c1.dataset.name}.`), 300);

        const total = difficultyConfig[currentDifficulty].pairs;
        if (matchedPairs === total) {
            setTimeout(showVictoryModal, 1400);
        } else {
            setTimeout(() => { isBoardLocked = false; }, 600);
        }
    } else {
        // ❌ No coinciden — voltear de nuevo
        setTimeout(() => {
            soundSynth.playError();
            c1.classList.remove('flipped');
            c2.classList.remove('flipped');
            flippedCards  = [];
            isBoardLocked = false;
        }, 1000);
    }
}

/** Crea piezas de confeti animadas dentro del modal */
function createConfetti() {
    confettiContainer.innerHTML = '';
    const colors = ['#FF5722','#FFEB3B','#4CAF50','#00BCD4','#E91E63','#9C27B0'];
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.classList.add('confetti-piece');
        p.style.left            = `${Math.random() * 100}%`;
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDelay  = `${Math.random() * 2.5}s`;
        p.style.transform       = `scale(${Math.random() * 0.8 + 0.4})`;
        confettiContainer.appendChild(p);
    }
}

/** Muestra el modal de felicitación con el mensaje y opciones correctos */
function showVictoryModal() {
    createConfetti();
    modal.classList.remove('hidden');
    isBoardLocked = true;

    if (currentDifficulty === 'easy') {
        modalTitle.textContent   = '¡Excelente Trabajo! 🏆';
        modalMessage.textContent = '¡Completaste el nivel Fácil con 3 parejas! ¿Quieres intentar el nivel Medio?';
        nextLevelBtn.style.display = 'block';
        nextLevelBtn.textContent   = 'Ir al Nivel Medio 🚀';
        nextLevelBtn.onclick       = () => setDifficulty('medium');
        speak('¡Fantástico! Completaste el nivel fácil. ¿Te animas al nivel medio?');

    } else if (currentDifficulty === 'medium') {
        modalTitle.textContent   = '¡Increíble! 🌟';
        modalMessage.textContent = '¡Superaste el nivel Medio con 6 parejas! ¿Eres capaz del nivel Difícil?';
        nextLevelBtn.style.display = 'block';
        nextLevelBtn.textContent   = 'Ir al Nivel Difícil 🔥';
        nextLevelBtn.onclick       = () => setDifficulty('hard');
        speak('¡Increíble! Superaste el nivel medio. ¿Te atreves con el difícil?');

    } else {
        // Difícil — nivel máximo
        modalTitle.textContent   = '¡Eres un Súper Campeón! 🎉';
        modalMessage.textContent = '¡Completaste el nivel Difícil con 10 parejas! ¡Eres un experto en profesiones!';
        nextLevelBtn.style.display = 'none';
        speak('¡Felicidades campeón! Dominaste todas las profesiones. ¡Eres increíble!');
    }
}

// ── Eventos de los botones de control ──
resetBtn.addEventListener('click', () => {
    syncDifficultyBar(currentDifficulty);
    initGame();
});

playAgainBtn.addEventListener('click', () => {
    syncDifficultyBar(currentDifficulty);
    initGame();
});

// ── Arranque inicial ──
syncDifficultyBar(currentDifficulty);
initGame();
