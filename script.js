document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const resultSection = document.getElementById('resultSection');
    const errorMsg = document.getElementById('errorMsg');
    const btnText = document.querySelector('.btn-text');
    const btnIcon = document.querySelector('.btn-icon');
    const loader = document.querySelector('.loader');

    // Cobalt API instance - provides pre-merged YouTube streams
    const COBALT_API = 'https://api.cobalt.tools/api/json';
    
    // RapidAPI for other platforms
    const RAPIDAPI_URL = 'https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink';
    const RAPIDAPI_KEY = '5dc721e18cmsh0d6b0f2e1b1f59cp1e000ajsnedde84a4491a';

    downloadBtn.addEventListener('click', handleDownload);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleDownload();
    });

    function isYouTubeUrl(url) {
        return /(?:youtube\.com|youtu\.be)/i.test(url);
    }

    async function handleDownload() {
        const url = urlInput.value.trim();

        if (!url) {
            showError('Please enter a valid URL.');
            return;
        }

        hideError();
        resultSection.classList.add('hidden');
        resultSection.innerHTML = '';
        setLoading(true);

        try {
            let result;
            
            if (isYouTubeUrl(url)) {
                // Use Cobalt API for YouTube - provides merged video+audio
                result = await fetchFromCobalt(url);
            } else {
                // Use RapidAPI for other platforms
                result = await fetchFromRapidAPI(url);
            }

            if (result && result.medias && result.medias.length > 0) {
                displayResult(result);
            } else {
                throw new Error('No media found. The link might be private or invalid.');
            }

        } catch (error) {
            console.error(error);
            let msg = error.message;
            if (msg.includes('Failed to fetch')) {
                msg = 'Network Error: Could not connect to the server. Please try again.';
            }
            showError(msg);
        } finally {
            setLoading(false);
            resultSection.classList.remove('hidden');
        }
    }

    async function fetchFromCobalt(url) {
        // Try multiple Cobalt instances for reliability
        const cobaltInstances = [
            'https://api.cobalt.tools',
            'https://co.wuk.sh',
            'https://cobalt-api.hyper.lol'
        ];

        let lastError = null;

        for (const instance of cobaltInstances) {
            try {
                const response = await fetch(`${instance}/api/json`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: url,
                        vCodec: 'h264',
                        vQuality: '1080',
                        aFormat: 'mp3',
                        filenamePattern: 'basic',
                        isAudioOnly: false,
                        isTTFullAudio: true,
                        isAudioMuted: false,
                        dubLang: false,
                        disableMetadata: false
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.text || `API Error: ${response.status}`);
                }

                const data = await response.json();
                console.log('Cobalt response:', data);

                // Convert Cobalt response to our standard format
                return convertCobaltResponse(data, url);

            } catch (error) {
                console.warn(`Cobalt instance ${instance} failed:`, error.message);
                lastError = error;
                continue;
            }
        }

        // All Cobalt instances failed, fallback to RapidAPI
        console.log('All Cobalt instances failed, falling back to RapidAPI');
        return await fetchFromRapidAPI(url);
    }

    function convertCobaltResponse(data, originalUrl) {
        const medias = [];

        if (data.status === 'error') {
            throw new Error(data.text || 'Cobalt API error');
        }

        if (data.status === 'redirect' || data.status === 'stream') {
            // Single file download
            medias.push({
                url: data.url,
                quality: '1080p',
                type: 'video',
                extension: 'mp4',
                has_audio: true
            });
        } else if (data.status === 'picker') {
            // Multiple options available
            if (data.picker && Array.isArray(data.picker)) {
                data.picker.forEach((item, index) => {
                    medias.push({
                        url: item.url,
                        quality: item.type === 'photo' ? 'Photo' : `Option ${index + 1}`,
                        type: item.type === 'photo' ? 'image' : 'video',
                        extension: item.type === 'photo' ? 'jpg' : 'mp4',
                        has_audio: true,
                        thumb: item.thumb
                    });
                });
            }
        }

        // Also try to get audio-only version
        if (data.audio) {
            medias.push({
                url: data.audio,
                quality: 'Audio',
                type: 'audio',
                extension: 'mp3',
                is_audio: true
            });
        }

        return {
            title: data.filename || 'YouTube Video',
            thumbnail: data.thumb || '',
            source: 'YouTube',
            medias: medias
        };
    }

    async function fetchFromRapidAPI(url) {
        const response = await fetch(RAPIDAPI_URL, {
            method: 'POST',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'social-download-all-in-one.p.rapidapi.com',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
        }

        return await response.json();
    }

    function setLoading(isLoading) {
        if (isLoading) {
            btnText.classList.add('hidden');
            btnIcon.classList.add('hidden');
            loader.classList.remove('hidden');
            downloadBtn.disabled = true;
        } else {
            btnText.classList.remove('hidden');
            btnIcon.classList.remove('hidden');
            loader.classList.add('hidden');
            downloadBtn.disabled = false;
        }
    }

    function showError(message) {
        errorMsg.querySelector('span').textContent = message;
        errorMsg.classList.remove('hidden');
    }

    function hideError() {
        errorMsg.classList.add('hidden');
    }

    function displayResult(data) {
        resultSection.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'result-card animate-fade-up';

        // Thumbnail Section
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'thumbnail-container';

        if (data.thumbnail) {
            const img = document.createElement('img');
            img.src = data.thumbnail;
            img.alt = data.title || 'Video Thumbnail';
            img.onerror = () => {
                img.style.display = 'none';
            };
            thumbContainer.appendChild(img);
        }

        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        if (data.source) {
            const badge = document.createElement('div');
            badge.className = 'source-badge';
            let iconClass = 'fa-solid fa-share-nodes';
            const source = data.source.toLowerCase();
            if (source.includes('tiktok')) iconClass = 'fa-brands fa-tiktok';
            else if (source.includes('instagram')) iconClass = 'fa-brands fa-instagram';
            else if (source.includes('youtube')) iconClass = 'fa-brands fa-youtube';
            else if (source.includes('facebook')) iconClass = 'fa-brands fa-facebook';
            else if (source.includes('twitter') || source.includes('x')) iconClass = 'fa-brands fa-twitter';

            badge.innerHTML = `<i class="${iconClass}"></i> ${data.source}`;
            overlay.appendChild(badge);
        }
        thumbContainer.appendChild(overlay);
        card.appendChild(thumbContainer);

        // Info Section
        const infoContainer = document.createElement('div');
        infoContainer.className = 'info-container';

        if (data.title) {
            const title = document.createElement('h3');
            title.className = 'video-title';
            title.textContent = data.title;
            infoContainer.appendChild(title);
        }

        const downloadList = document.createElement('div');
        downloadList.className = 'download-list';

        if (data.medias && data.medias.length > 0) {
            data.medias.forEach(media => {
                if (!media.url) return;

                const isAudio = (media.type === 'audio' || media.extension === 'mp3' || media.extension === 'm4a' || media.is_audio);
                const hasAudio = Boolean(media.has_audio || media.audioAvailable || media.audio || media.withAudio);

                const btn = document.createElement('a');
                btn.href = media.url;
                btn.className = `dl-btn ${isAudio ? 'audio-btn' : 'video-btn'}`;
                btn.target = '_blank';
                btn.rel = 'noopener noreferrer';
                btn.download = ''; // Suggest download

                const btnContent = document.createElement('div');
                btnContent.className = 'btn-content';

                const icon = document.createElement('i');
                icon.className = isAudio ? 'fa-solid fa-music' : 'fa-solid fa-video';
                btnContent.appendChild(icon);

                const details = document.createElement('div');
                details.className = 'btn-details';

                const quality = document.createElement('span');
                quality.className = 'btn-quality';
                quality.textContent = media.quality || (isAudio ? 'Audio' : 'Video');
                details.appendChild(quality);

                // Show audio status tag
                const tag = document.createElement('span');
                tag.className = 'btn-tag';
                if (isAudio) {
                    tag.textContent = 'Audio only';
                } else if (hasAudio) {
                    tag.textContent = 'Video + Audio';
                    tag.style.background = 'rgba(0, 255, 136, 0.15)';
                    tag.style.color = '#00ff88';
                } else {
                    tag.textContent = 'Video only';
                    tag.style.background = 'rgba(255, 71, 87, 0.15)';
                    tag.style.color = '#ff4757';
                }
                details.appendChild(tag);

                let sizeText = '';
                if (media.size) sizeText = formatSize(media.size);
                else if (media.formattedSize) sizeText = media.formattedSize;
                else if (media.extension) sizeText = media.extension.toUpperCase();

                if (sizeText) {
                    const size = document.createElement('span');
                    size.className = 'btn-size';
                    size.textContent = sizeText;
                    details.appendChild(size);
                }

                btnContent.appendChild(details);
                btn.appendChild(btnContent);

                const dlIcon = document.createElement('i');
                dlIcon.className = 'fa-solid fa-download download-icon';
                btn.appendChild(dlIcon);

                downloadList.appendChild(btn);
            });
        } else {
            const noLinks = document.createElement('p');
            noLinks.className = 'no-links';
            noLinks.textContent = 'No download links available.';
            downloadList.appendChild(noLinks);
        }

        infoContainer.appendChild(downloadList);
        card.appendChild(infoContainer);
        resultSection.appendChild(card);
        resultSection.classList.remove('hidden');
    }

    function formatSize(bytes) {
        if (!bytes) return '';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }
});
