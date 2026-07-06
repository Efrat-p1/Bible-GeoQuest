function cleanSefariaText(hebrewTextArray) {
    if (!hebrewTextArray || hebrewTextArray.length === 0) return "";
    let cleanText = Array.isArray(hebrewTextArray) ? hebrewTextArray.join(" ") : hebrewTextArray;
    
    cleanText = cleanText.replace(/<[^>]*>?/gm, ''); // Remove HTML tags
    cleanText = cleanText.replace(/\{[ספ]\}/g, ''); // Remove Sefaria paragraph markers
    
    // Decode HTML entities
    const textArea = document.createElement('textarea');
    textArea.innerHTML = cleanText;
    cleanText = textArea.value;
    
    cleanText = cleanText.replace(/\s+/g, ' ').trim(); // Clean up extra spaces
    return cleanText;
}

export async function fetchVerse(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.he && data.he.length > 0) {
            return cleanSefariaText(data.he);
        }
        return null;
    } catch (error) {
        console.error("Error fetching Sefaria API:", error);
        return null;
    }
}

export async function fetchChapter(ref) {
    try {
        const response = await fetch(`https://www.sefaria.org/api/texts/${ref}?context=0`);
        const data = await response.json();
        
        if (data && data.he && data.he.length > 0) {
            let html = "";
            data.he.forEach((verseHe, index) => {
                let cleanText = cleanSefariaText(verseHe);
                html += `<p><strong style="color:var(--secondary-color); margin-left: 10px;">${index+1}.</strong> ${cleanText}</p>`;
            });
            return {
                title: data.heRef || ref,
                html: html
            };
        }
        return { title: ref, html: "<p>לא נמצא טקסט לפרק זה.</p>" };
    } catch (error) {
        console.error("Error fetching full chapter:", error);
        return { title: ref, html: "<p>שגיאה בטעינת הפרק.</p>" };
    }
}
