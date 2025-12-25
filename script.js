document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const resultSection = document.getElementById('resultSection');
    const errorMsg = document.getElementById('errorMsg');
    const btnText = document.querySelector('.btn-text');
    const btnIcon = document.querySelector('.btn-icon');
    const loader = document.querySelector('.loader');

    downloadBtn.addEventListener('click', handleDownload);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleDownload();
    });

    async function handleDownload() {
        const url = urlInput.value.trim();

        if (!url) {
            showError('Please enter a valid URL.');
            return;
        }

        // Reset UI
        hideError();
        resultSection.classList.add('hidden');
        resultSection.innerHTML = '';
        setLoading(true);

        const apiUrl = 'https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink';
        const options = {
            method: 'POST',
            headers: {
                'x-rapidapi-key': '5dc721e18cmsh0d6b0f2e1b1f59cp1e000ajsnedde84a4491a',
                'x-rapidapi-host': 'social-download-all-in-one.p.rapidapi.com',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
        };

        try {
            const response = await fetch(apiUrl, options);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
            }

            const result = await response.json();
            console.log(result); // Debugging

            if (result && result.medias && result.medias.length > 0) {
                displayResult(result);
            } else {
                throw new Error('No media found. The link might be private or invalid.');
            }

        } catch (error) {
            console.error(error);
            // Check for common fetch errors
            let msg = error.message;
            if (msg.includes('Failed to fetch')) {
                msg = 'Network Error: Possible CORS issue or no internet connection. Try using a local server (e.g., Live Server) instead of opening the file directly.';
            }
            showError(msg);
        } finally {
            setLoading(false);
            resultSection.classList.remove('hidden');
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
            thumbContainer.appendChild(img);
        }

        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        if (data.source) {
            const badge = document.createElement('div');
            badge.className = 'source-badge';
            // Simple mapping for icons
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

        if (data.medias) {
            data.medias.forEach(media => {
                if (!media.url) return;

                const btn = document.createElement('a');
                btn.href = media.url;
                // Determine class based on type (video/audio)
                const isAudio = (media.type === 'audio' || media.extension === 'mp3' || media.is_audio);
                btn.className = `dl-btn ${isAudio ? 'audio-btn' : 'video-btn'}`;
                btn.target = '_blank';
                btn.rel = 'noopener noreferrer';

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
