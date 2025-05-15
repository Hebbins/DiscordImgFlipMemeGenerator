/**
 * @name ImgFlipMemeGenerator
 * @author Hebbins
 * @description Search and generate memes from ImgFlip directly in Discord
 * @version 1.2.1
 */

module.exports = meta => {
    return {
        start() {
            this.initialized = false;
            this.memeCache = [];
            this.currentMeme = null;
            this.popupOpen = false;
            this.memeButtons = [];
            this.settings = this.loadSettings();
            this.initialize();
        },

        stop() {
            if (this.initialized) {
                document.removeEventListener('click', this.documentClickHandler);
                this.removeButton();
                this.closePopup();
                BdApi.DOM.removeStyle("ImgFlipMemeGenerator");
            }
        },

        getSettingsPanel() {
            const panel = document.createElement("div");
            panel.className = "imgflip-settings";
            panel.innerHTML = `
                <h3>ImgFlip Meme Generator Settings</h3>
                <div class="setting-item">
                    <label>Max results to show: </label>
                    <input type="number" id="imgflip-max-results" min="10" max="100" value="${this.settings.maxResults}">
                </div>
                <div class="setting-item">
                    <label>ImgFlip Username: </label>
                    <input type="text" id="imgflip-username" placeholder="Your ImgFlip username" value="${this.settings.username || ""}">
                </div>
                <div class="setting-item">
                    <label>ImgFlip Password: </label>
                    <input type="password" id="imgflip-password" placeholder="Your ImgFlip password" value="${this.settings.password || ""}">
                </div>
                <div style="margin:8px 0 0 0; color:var(--text-muted); font-size:13px;">
                    If you don't have credentials, <a href="https://imgflip.com/signup" target="_blank" style="color:var(--brand-experiment);text-decoration:underline;">sign up here</a>.
                </div>
            `;

            setTimeout(() => {
                const maxResultsInput = panel.querySelector("#imgflip-max-results");
                if (maxResultsInput) {
                    maxResultsInput.addEventListener("change", () => {
                        this.settings.maxResults = parseInt(maxResultsInput.value) || 50;
                        this.saveSettings();
                    });
                }
                const usernameInput = panel.querySelector("#imgflip-username");
                if (usernameInput) {
                    usernameInput.addEventListener("input", () => {
                        this.settings.username = usernameInput.value;
                        this.saveSettings();
                    });
                }
                const passwordInput = panel.querySelector("#imgflip-password");
                if (passwordInput) {
                    passwordInput.addEventListener("input", () => {
                        this.settings.password = passwordInput.value;
                        this.saveSettings();
                    });
                }
            }, 0);

            return panel;
        },

        loadSettings() {
            const defaultSettings = {
                maxResults: 50,
                username: "",
                password: ""
            };
            const loadedSettings = BdApi.Data.load("ImgFlipMemeGenerator", "settings");
            return {...defaultSettings, ...loadedSettings };
        },

        saveSettings() {
            BdApi.Data.save("ImgFlipMemeGenerator", "settings", this.settings);
        },

        initialize() {
            this.loadStylesheet();
            this.addButton();
            this.documentClickHandler = this.handleDocumentClick.bind(this);
            document.addEventListener('click', this.documentClickHandler);
            this.fetchMemes();
            BdApi.UI.showToast("ImgFlip Meme Generator loaded", { type: "success" });
            this.initialized = true;
        },

        loadStylesheet() {
            BdApi.DOM.addStyle("ImgFlipMemeGenerator", `
                .imgflip-button { background-color: transparent; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin: 0 8px; cursor: pointer; color: var(--interactive-normal); position: relative; }
                .imgflip-button:hover { color: var(--interactive-hover); }
                .imgflip-button svg { width: 32px; height: 32px; }
                .imgflip-popup { position: absolute; width: 500px; max-height: 650px; background-color: var(--background-secondary); border-radius: 8px; box-shadow: var(--elevation-high); z-index: 1000; display: flex; flex-direction: column; }
                .imgflip-header { flex-shrink: 0; padding: 16px; border-bottom: 1px solid var(--background-tertiary); }
                .imgflip-title { font-weight: bold; font-size: 16px; margin-bottom: 12px; color: var(--header-primary); }
                .imgflip-search { width: 100%; padding: 8px 12px; background-color: var(--background-tertiary); border: none; border-radius: 4px; color: var(--text-normal); outline: none; }
                .imgflip-search::placeholder { color: var(--text-muted); }
                .imgflip-content { flex: 1; overflow-y: auto; padding: 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-height: 500px; }
                .imgflip-meme { background-color: var(--background-tertiary); border-radius: 4px; overflow: hidden; cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column; height: 200px; }
                .imgflip-meme:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); }
                .imgflip-meme-img { width: 100%; height: 160px; object-fit: contain; background-color: var(--background-primary); }
                .imgflip-meme-name { padding: 8px; font-size: 12px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; color: var(--text-normal); }
                .imgflip-meme-editor { grid-column: 1 / -1; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; padding: 16px; overflow-y: auto; }
                .imgflip-meme-preview { width: 100%; max-height: 200px; object-fit: contain; margin-bottom: 16px; background-color: var(--background-primary); }
                .imgflip-text-inputs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
                .imgflip-text-input { padding: 8px 12px; background-color: var(--background-tertiary); border: none; border-radius: 4px; color: var(--text-normal); outline: none; }
                .imgflip-buttons { display: flex; gap: 8px; }
                .imgflip-button-preview, .imgflip-button-insert { padding: 8px 16px; border: none; border-radius: 4px; font-weight: 500; cursor: pointer; }
                .imgflip-button-preview { background-color: var(--background-tertiary); color: var(--text-normal); }
                .imgflip-button-insert { background-color: var(--brand-experiment); color: white; }
                .imgflip-footer { padding: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--background-tertiary); font-size: 12px; color: var(--text-muted); }
                .imgflip-loading, .imgflip-no-results { display: flex; justify-content: center; align-items: center; height: 100px; color: var(--text-muted); grid-column: 1 / -1; }
                .imgflip-back { display: flex; align-items: center; gap: 4px; padding: 8px; cursor: pointer; color: var(--text-normal); border-radius: 4px; margin-bottom: 12px; font-size: 14px; }
                .imgflip-back:hover { background-color: var(--background-modifier-hover); }
                .imgflip-settings { color: var(--header-primary); margin: 10px; }
                .imgflip-settings .setting-item { margin: 10px 0; display: flex; align-items: center; justify-content: space-between; }
                .imgflip-settings input { background-color: var(--background-tertiary); border: none; color: var(--text-normal); padding: 8px; border-radius: 4px; width: 260px; max-width: 100%; box-sizing: border-box; }
                * { scrollbar-width: thin; scrollbar-color: #1a1b1e #2b2d31; }
                *::-webkit-scrollbar { width: 8px; background: #2b2d31; }
                *::-webkit-scrollbar-thumb { background: #1a1b1e; border-radius: 8px; border: 2px solid #2b2d31; }
                *::-webkit-scrollbar-track { background: #2b2d31; border-radius: 8px; }
            `);
        },

        addButton() {
            if (!this.buttonObserver) {
                this.buttonObserver = new MutationObserver(() => this.findAndAddButtons());
                this.buttonObserver.observe(document.body, { childList: true, subtree: true });
                this.findAndAddButtons();
                setTimeout(() => this.findAndAddButtons(), 2000);
            }
        },

        findAndAddButtons() {
            const buttonsContainers = document.querySelectorAll('[class*="buttons__"]');
            buttonsContainers.forEach(container => {
                if (container.querySelector('.imgflip-button') || !container.closest('[class*="inner__"]')) {
                    return;
                }

                const button = document.createElement('button');
                button.className = 'imgflip-button';
                button.setAttribute('aria-label', 'Insert Meme');
                button.innerHTML = `
                    <svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<g fill="none">
							<rect x="1" y="1" width="30" height="30" rx="2" ry="2"/> <path d="M4 25 l6 -8 l5 6 l6 -8 l7 10"/> <circle cx="24" cy="10" r="4"/> <g transform="translate(25, 7) rotate(45)">
							<rect x="-2" y="-10" width="4" height="18"/>
							<polygon points="-2 8 2 8 0 11"/>
							<rect x="-2" y="-13" width="4" height="3"/>
							</g>
						</g>
					</svg>`;
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.togglePopup(button);
                });
                container.prepend(button);
                if (!this.memeButtons) this.memeButtons = [];
                this.memeButtons.push(button);
            });
        },

        removeButton() {
            if (this.buttonObserver) {
                this.buttonObserver.disconnect();
                this.buttonObserver = null;
            }
            if (this.memeButtons && this.memeButtons.length > 0) {
                this.memeButtons.forEach(button => button && button.parentNode && button.parentNode.removeChild(button));
                this.memeButtons = [];
            }
        },

        togglePopup(buttonElement) {
            this.popupOpen ? this.closePopup() : this.openPopup(buttonElement);
        },

        openPopup(buttonElement) {
            this.memeButton = buttonElement;
            const buttonRect = buttonElement.getBoundingClientRect();
            const popup = document.createElement('div');
            popup.className = 'imgflip-popup';
            popup.style.bottom = `${window.innerHeight - buttonRect.top + 10}px`;
            popup.style.left = `${buttonRect.left - 450}px`;

            const header = document.createElement('div');
            header.className = 'imgflip-header';
            header.innerHTML = `<div class="imgflip-title">ImgFlip Meme Generator</div><input type="text" class="imgflip-search" placeholder="Search memes...">`;
            popup.appendChild(header);

            const content = document.createElement('div');
            content.className = 'imgflip-content';
            content.innerHTML = '<div class="imgflip-loading">Loading popular memes...</div>';
            popup.appendChild(content);

            const footer = document.createElement('div');
            footer.className = 'imgflip-footer';
            footer.innerHTML = 'Powered by ImgFlip API | Integrated by Hebbins';
            popup.appendChild(footer);

            document.body.appendChild(popup);
            this.popup = popup;
            this.popupOpen = true;

            setTimeout(() => {
                const searchInput = popup.querySelector('.imgflip-search');
                searchInput.focus();
                searchInput.addEventListener('input', () => this.searchMemes(searchInput.value));
            }, 100);

            this.memeCache.length > 0 ? this.displayMemes(this.memeCache) : this.fetchMemes();
        },

        closePopup() {
            if (this.popup && this.popup.parentNode) {
                this.popup.parentNode.removeChild(this.popup);
                this.popup = null;
                this.popupOpen = false;
                this.memeButton = null;
            }
        },

        handleDocumentClick(event) {
            if (this.popupOpen && this.popup && !this.popup.contains(event.target) &&
                (!this.memeButton || !this.memeButton.contains(event.target))) {
                this.closePopup();
            }
        },

        fetchMemes() {
            fetch('https://api.imgflip.com/get_memes')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.memeCache = data.data.memes;
                        if (this.popupOpen) this.displayMemes(this.memeCache);
                    } else {
                        // API returned success: false, could potentially log this or show toast if helpful
                    }
                })
                .catch(error => {
                    // Error fetching, could potentially log this or show toast if helpful
                    if (this.popupOpen) {
                        const content = this.popup.querySelector('.imgflip-content');
                        content.innerHTML = '<div class="imgflip-no-results">Failed to load memes. Please try again.</div>';
                    }
                });
        },

        searchMemes(query) {
            if (!this.popup) return;
            const content = this.popup.querySelector('.imgflip-content');
            content.innerHTML = '<div class="imgflip-loading">Searching...</div>';

            if (!query) {
                this.displayMemes(this.memeCache);
                return;
            }
            const lowerQuery = query.toLowerCase();
            const filteredMemes = this.memeCache.filter(meme => meme.name.toLowerCase().includes(lowerQuery));
            this.displayMemes(filteredMemes);
        },

        displayMemes(memes) {
            if (!this.popupOpen || !this.popup) return;
            const content = this.popup.querySelector('.imgflip-content');

            if (memes.length === 0) {
                content.innerHTML = '<div class="imgflip-no-results">No memes found</div>';
                return;
            }
            content.innerHTML = '';
            const limitedMemes = memes.slice(0, this.settings.maxResults);

            limitedMemes.forEach(meme => {
                const memeElement = document.createElement('div');
                memeElement.className = 'imgflip-meme';
                memeElement.innerHTML = `<img class="imgflip-meme-img" src="${meme.url}" alt="${meme.name}" loading="lazy"><div class="imgflip-meme-name">${meme.name}</div>`;
                memeElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openMemeEditor(meme);
                });
                content.appendChild(memeElement);
            });

            if (memes.length > this.settings.maxResults) {
                const countElement = document.createElement('div');
                countElement.className = 'imgflip-no-results';
                countElement.textContent = `Showing ${this.settings.maxResults} of ${memes.length} results`;
                content.appendChild(countElement);
            }
        },

        openMemeEditor(meme) {
            this.currentMeme = meme;
            const content = this.popup.querySelector('.imgflip-content');
            const header = this.popup.querySelector('.imgflip-header');
            content.innerHTML = '';

            header.innerHTML = `
                <div class="imgflip-back">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                    Back to memes
                </div>
                <div class="imgflip-title">${meme.name}</div>`;

            const backButton = header.querySelector('.imgflip-back');
            backButton.addEventListener('click', (e) => {
                e.stopPropagation();
                header.innerHTML = `<div class="imgflip-title">ImgFlip Meme Generator</div><input type="text" class="imgflip-search" placeholder="Search memes...">`;
                const searchInput = header.querySelector('.imgflip-search');
                searchInput.addEventListener('input', () => this.searchMemes(searchInput.value));
                this.displayMemes(this.memeCache);
            });

            const memeEditor = document.createElement('div');
            memeEditor.className = 'imgflip-meme-editor';
            const previewImg = document.createElement('img');
            previewImg.className = 'imgflip-meme-preview';
            previewImg.src = meme.url;
            previewImg.alt = meme.name;
            memeEditor.appendChild(previewImg);

            const textInputsContainer = document.createElement('div');
            textInputsContainer.className = 'imgflip-text-inputs';
            const boxCount = meme.box_count || 2;
            for (let i = 0; i < boxCount; i++) {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'imgflip-text-input';
                input.placeholder = `Text #${i + 1}`;
                input.dataset.boxIndex = i;
                textInputsContainer.appendChild(input);
            }
            memeEditor.appendChild(textInputsContainer);

            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'imgflip-buttons';
            const previewButton = document.createElement('button');
            previewButton.className = 'imgflip-button-preview';
            previewButton.textContent = 'Preview';
            previewButton.addEventListener('click', async () => {
                const textInputs = memeEditor.querySelectorAll('.imgflip-text-input');
                const boxes = Array.from(textInputs).map(input => input.value);
                const memeId = this.currentMeme.id;
                const params = new URLSearchParams();
                params.append('template_id', memeId);
                params.append('username', this.settings.username || '');
                params.append('password', this.settings.password || '');
                boxes.forEach((text, i) => params.append(`boxes[${i}][text]`, text));

                const response = await fetch('https://api.imgflip.com/caption_image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString()
                });
                const data = await response.json();
                const imgPreview = memeEditor.querySelector('.imgflip-meme-preview');
                if (imgPreview) {
                    if (data.success) {
                        imgPreview.src = data.data.url;
                    } else {
                        imgPreview.src = '';
                        BdApi.UI.showToast('Failed to generate meme preview: ' + data.error_message, { type: 'error' });
                    }
                }
            });
            buttonsContainer.appendChild(previewButton);

            const insertButton = document.createElement('button');
            insertButton.className = 'imgflip-button-insert';
            insertButton.textContent = 'Generate & Insert';
            insertButton.addEventListener('click', () => this.generateAndInsertMeme());
            buttonsContainer.appendChild(insertButton);
            memeEditor.appendChild(buttonsContainer);
            content.appendChild(memeEditor);

            setTimeout(() => {
                const firstInput = textInputsContainer.querySelector('input');
                if (firstInput) firstInput.focus();
            }, 100);
        },

        previewMeme(memeEditorElement) {
            if (!this.currentMeme) return;
            const textInputs = memeEditorElement.querySelectorAll('.imgflip-text-input');
            const boxes = Array.from(textInputs).map(input => input.value);
            const memeId = this.currentMeme.id;
            const params = new URLSearchParams();
            params.append('template_id', memeId);
            params.append('username', this.settings.username || '');
            params.append('password', this.settings.password || '');
            boxes.forEach((text, i) => params.append(`boxes[${i}][text]`, text));
            const previewUrl = `https://api.imgflip.com/caption_image?${params.toString()}`;
            const imgPreview = memeEditorElement.querySelector('.imgflip-meme-preview');
            if (imgPreview) imgPreview.src = previewUrl;
        },

        generateAndInsertMeme() {
            if (!this.currentMeme) return;
            const textInputs = this.popup.querySelectorAll('.imgflip-text-input');
            const formData = new FormData();
            formData.append('template_id', this.currentMeme.id);
            formData.append('username', this.settings.username || '');
            formData.append('password', this.settings.password || '');
            textInputs.forEach((input, index) => {
                formData.append(`boxes[${index}][text]`, input.value.trim() || '');
            });

            const insertButton = this.popup.querySelector('.imgflip-button-insert');
            const originalText = insertButton.textContent;
            insertButton.textContent = 'Generating...';
            insertButton.disabled = true;

            fetch('https://api.imgflip.com/caption_image', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    insertButton.textContent = originalText;
                    insertButton.disabled = false;
                    if (data.success) {
                        this.insertIntoChat(data.data.url);
                        this.closePopup();
                    } else {
                        BdApi.UI.showToast(`Failed to generate meme: ${data.error_message}`, { type: "error" });
                    }
                })
                .catch(error => {
                    insertButton.textContent = originalText;
                    insertButton.disabled = false;
                    BdApi.UI.showToast('Failed to generate meme. Please try again.', { type: "error" });
                });
        },

        insertIntoChat(memeUrl) {
            const input = document.querySelector('[class*="channelTextArea"] div[contenteditable="true"]');
            if (!input) {
                BdApi.UI.showToast("Couldn't find the message input box!", { type: "error" });
                return;
            }
            input.focus();
            for (const char of memeUrl) {
                const event = new InputEvent('beforeinput', { inputType: 'insertText', data: char, bubbles: true, cancelable: true });
                input.dispatchEvent(event);
            }
        }
    };
};