function addBold() {
    addSimpleTag("b");
}

function addItalic() {
    addSimpleTag("i");
}

function addUnderline() {
    addSimpleTag("u");
}

isEditingOOC = false;
function toggleOOC() {
    let editboxes = document.getElementsByClassName("edit-text-area");
    let buttonEle = document.getElementById("toggleOOCButon");
    isEditingOOC = !isEditingOOC;
    for (let box of editboxes) {
        if (isEditingOOC) {
            box.classList.add("editing-ooc");
            buttonEle.innerHTML = "Edit Text";
        } else {
            box.classList.remove("editing-ooc");
            buttonEle.innerHTML = "Edit OOC";
        }
    }
}

function getSelection() {
    let selectionObject = {
        start: 0,
        end: 0
    }
    let areaEle = document.getElementById("post-box-text-area");
    if (isEditingOOC) {
        areaEle = document.getElementById("post-box-ooc-area");
    }

    if (areaEle.selectionStart || areaEle.selectionStart == 0) {
        selectionObject.start = areaEle.selectionStart;
        selectionObject.end = areaEle.selectionEnd;
    } else {
        selectionObject.start = areaEle.value.length;
        selectionObject.end = areaEle.value.length;
    }
    return selectionObject;
}

function addTextAroundSelection(startText, endText) {
    let sel = getSelection();
    
    let areaEle = document.getElementById("post-box-text-area");
    if (isEditingOOC) {
        areaEle = document.getElementById("post-box-ooc-area");
    }

    let fulltext = areaEle.value;
    fulltext = fulltext.substring(0, sel.start) + startText + fulltext.substring(sel.start, sel.end) + endText + fulltext.substring(sel.end);
    areaEle.value = fulltext;

    areaEle.selectionStart = sel.start + startText.length;
    areaEle.selectionEnd = sel.end + startText.length;
    updatePreview()
}

function addSimpleTag(tag) {
    addTextAroundSelection("[" + tag + "]", "[/" + tag + "]");
}

function updatePreview() {
    let areaEle = document.getElementById("post-box-text-area");
    let areaEle2 = document.getElementById("post-box-ooc-area");

    let fulltext = areaEle.value;
    let fulltext2 = areaEle2.value;

    let previewEle = document.getElementById("previewTextArea");
    let previewEle2 = document.getElementById("previewOOCArea");

    previewEle.innerHTML = XBBCODE.process({
        text: fulltext,
        removeMisalignedTags: false,
        addInLineBreaks: false
      }).html;
    
    previewEle2.innerHTML = XBBCODE.process({
        text: fulltext2,
        removeMisalignedTags: false,
        addInLineBreaks: false
      }).html;
}

function toggleShowPostOOC(id) {
    let ele = document.getElementById("post" + id);
    if (ele) {
        ele.classList.toggle("showing-ooc");
    } else {
        console.log("Could not locate post " + id);
    }
}