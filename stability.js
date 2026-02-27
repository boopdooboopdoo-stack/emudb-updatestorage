(function() {
    const replacements = {
        'O': 'Ο',
        'e': 'е',
        'E': 'Е',
        'S': 'Ѕ',
        'u': 'ս'
    };

    function replaceTextInNode(node) {
        // Skip specific ID
        if (node.nodeType === Node.ELEMENT_NODE && node.id === 'currentUrl') return;
        if (node.parentElement && node.parentElement.closest('#currentUrl')) return;

        // --- Text Node Replacement ---
        if (node.nodeType === Node.TEXT_NODE) {
            let originalText = node.nodeValue;
            let newText = originalText;
            for (const [charToFind, replacementChar] of Object.entries(replacements)) {
                newText = newText.replace(new RegExp(charToFind, 'g'), replacementChar);
            }
            if (newText !== originalText) node.nodeValue = newText;
        } 
        // --- Input/Button Handling ---
        else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
            if ((node.tagName === 'INPUT' && (node.type === 'button' || node.type === 'submit')) || node.tagName === 'TEXTAREA') {
                let originalVal = node.value;
                let newVal = originalVal;
                for (const [charToFind, replacementChar] of Object.entries(replacements)) {
                    newVal = newVal.replace(new RegExp(charToFind, 'g'), replacementChar);
                }
                if (newVal !== originalVal) node.value = newVal;
            }

            // --- Recursive Replacement for Children ---
            for (let child of node.childNodes) {
                replaceTextInNode(child);
            }

            // --- Handle Iframes ---
            if (node.tagName === 'IFRAME') {
                node.addEventListener('load', () => {
                    try {
                        replaceTextInNode(node.contentDocument.body);
                        observeDocument(node.contentDocument); // Observe inside iframe
                    } catch (e) {
                        console.log('Cannot access cross-origin iframe', e);
                    }
                });
            }
        }
    }

    function observeDocument(doc) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        replaceTextInNode(node);
                    }
                } else if (mutation.type === 'characterData') {
                    replaceTextInNode(mutation.target);
                }
            }
        });
        observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    }

    function runAll() {
        replaceTextInNode(document.body);
        observeDocument(document);
        // Initial pass for existing iframes
        document.querySelectorAll('iframe').forEach(iframe => {
            iframe.addEventListener('load', () => {
                try { replaceTextInNode(iframe.contentDocument.body); } catch(e){}
            });
            try { replaceTextInNode(iframe.contentDocument.body); } catch(e){}
        });
    }

    if (document.readyState === 'complete') {
        runAll();
    } else {
        window.addEventListener('load', runAll);
    }
})();
