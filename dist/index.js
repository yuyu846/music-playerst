import { extension_settings } from "../../../extensions.js";

const extensionName = "music-playerst";
const defaultSettings = {
    playlist: [],
    volume: 0.5,
    lastPlayedIndex: 0
};

// 确保设置存在
if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = defaultSettings;
}

let audio = new Audio();
let isPlaying = false;
let currentPlaylist = extension_settings[extensionName].playlist || [];
let currentIndex = 0;

function saveSettings() {
    extension_settings[extensionName].playlist = currentPlaylist;
    extension_settings[extensionName].lastPlayedIndex = currentIndex;
    // 酒馆会自动保存 extension_settings，通常不需要手动触发文件写入，
    // 但如果有特定的保存函数可以使用 saveExtensionSettings()
}

// HTML 模板
const template = `
<div id="st-music-player-container">
    <div class="st-player-header" id="st-player-drag">
        <span class="st-player-title">🎵 音乐播放器</span>
        <span class="st-player-toggle" id="st-player-min-btn">_</span>
    </div>
    <div class="st-player-body" id="st-player-content">
        <div class="st-progress-container" id="st-progress-bg">
            <div class="st-progress-bar" id="st-progress-fill"></div>
        </div>
        <div class="st-player-controls">
            <button class="st-btn" id="st-prev-btn">⏮</button>
            <button class="st-btn" id="st-play-btn">▶</button>
            <button class="st-btn" id="st-next-btn">⏭</button>
        </div>
        <div class="st-input-group">
            <input type="text" id="st-music-url" placeholder="输入音频直链 (mp3/wav)...">
            <button id="st-add-btn" style="cursor:pointer;">➕</button>
        </div>
        <div class="st-playlist" id="st-playlist-box">
            <!-- 列表项将在这里生成 -->
        </div>
    </div>
</div>
`;

function renderPlaylist() {
    const box = document.getElementById('st-playlist-box');
    box.innerHTML = '';
    currentPlaylist.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `st-playlist-item ${index === currentIndex ? 'active' : ''}`;
        div.innerHTML = `
            <span class="st-song-name">${index + 1}. ${item.name || '未知曲目'}</span>
            <span class="st-remove-btn" data-index="${index}">×</span>
        `;
        
        // 点击播放
        div.querySelector('.st-song-name').addEventListener('click', () => {
            playTrack(index);
        });

        // 点击删除
        div.querySelector('.st-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeTrack(index);
        });

        box.appendChild(div);
    });
    saveSettings();
}

function addTrack() {
    const input = document.getElementById('st-music-url');
    const url = input.value.trim();
    if (!url) return;

    // 尝试从URL获取文件名
    const name = url.split('/').pop().split('?')[0] || '新建曲目';
    
    currentPlaylist.push({ name, url });
    input.value = '';
    renderPlaylist();
    if (currentPlaylist.length === 1) {
        // 如果是第一首，自动加载但不播放
        loadTrack(0);
    }
}

function removeTrack(index) {
    currentPlaylist.splice(index, 1);
    if (index === currentIndex) {
        audio.pause();
        currentIndex = 0;
        if (currentPlaylist.length > 0) loadTrack(0);
    } else if (index < currentIndex) {
        currentIndex--;
    }
    renderPlaylist();
}

function loadTrack(index) {
    if (index < 0 || index >= currentPlaylist.length) return;
    currentIndex = index;
    audio.src = currentPlaylist[index].url;
    audio.load();
    renderPlaylist();
    updatePlayButton();
}

function playTrack(index) {
    loadTrack(index);
    audio.play().catch(e => console.error("播放失败:", e));
    isPlaying = true;
    updatePlayButton();
}

function togglePlay() {
    if (currentPlaylist.length === 0) return;
    
    if (audio.paused) {
        audio.play();
        isPlaying = true;
    } else {
        audio.pause();
        isPlaying = false;
    }
    updatePlayButton();
}

function updatePlayButton() {
    const btn = document.getElementById('st-play-btn');
    btn.innerHTML = audio.paused ? '▶' : '⏸';
}

function playNext() {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= currentPlaylist.length) nextIndex = 0;
    playTrack(nextIndex);
}

function playPrev() {
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = currentPlaylist.length - 1;
    playTrack(prevIndex);
}

// 初始化 UI 和事件
jQuery(async () => {
    $('body').append(template);

    // 按钮事件
    $('#st-play-btn').on('click', togglePlay);
    $('#st-next-btn').on('click', playNext);
    $('#st-prev-btn').on('click', playPrev);
    $('#st-add-btn').on('click', addTrack);

    // 播放器事件
    audio.addEventListener('ended', playNext);
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            document.getElementById('st-progress-fill').style.width = percent + '%';
        }
    });

    // 进度条点击
    $('#st-progress-bg').on('click', (e) => {
        if (!audio.duration) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = x / width;
        audio.currentTime = percent * audio.duration;
    });

    // 最小化/展开
    $('#st-player-min-btn').on('click', () => {
        $('#st-player-content').slideToggle();
    });

    // 简单的拖拽逻辑
    const dragItem = document.getElementById('st-music-player-container');
    const header = document.getElementById('st-player-drag');
    
    let active = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener("mousedown", dragStart, false);
    document.addEventListener("mouseup", dragEnd, false);
    document.addEventListener("mousemove", drag, false);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target === header || e.target.parentNode === header) {
            active = true;
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        active = false;
    }

    function drag(e) {
        if (active) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, dragItem);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
    }

    // 加载保存的列表
    renderPlaylist();
    if (currentPlaylist.length > 0) {
        // 恢复上一首但不自动播放，以免打扰
        loadTrack(Math.min(extension_settings[extensionName].lastPlayedIndex, currentPlaylist.length - 1));
    }
});
