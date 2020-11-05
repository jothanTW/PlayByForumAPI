function updateUserImage() {
    let inele = document.getElementById("userImageUpload");
    let imele = document.getElementById("userimageele");
    let files = inele.files;
    if (FileReader && files && files.length) {
        var fr = new FileReader();
        fr.onload = function () {
            imele.src = fr.result;
        }
        fr.readAsDataURL(files[0]);
    }
}

function sendUserImageData() {
    let inele = document.getElementById("userImageUpload");
    let files = inele.files;
    if (FileReader && files && files.length) {
        var fr = new FileReader();
        fr.onload = function () {
            let data = fr.result;
            data = data.substring(data.indexOf("base64,") + 7);

            var req = new XMLHttpRequest();
            req.open("PUT", "/icon");
            req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            req.addEventListener("load", evt => {
                let respObj = JSON.parse(req.response);
                
                document.getElementById("imageStatus").innerHTML = "";
                document.getElementById("imageError").innerHTML = "";
                if (respObj.status)
                    document.getElementById("imageStatus").innerHTML = respObj.status;
                if (respObj.error)
                    document.getElementById("imageError").innerHTML = respObj.error;
            })
            req.send(JSON.stringify({data: data}));
        }
        fr.readAsDataURL(files[0]);
    }
}

function handleUserTitleChange() {

}

function updateTitle() {
    let inp = document.getElementById("usertitleinput");
    let data = {
        title: inp.value
    }
    var req = new XMLHttpRequest();
    // hackish url get. should really get the user name
    req.open("PUT", window.location.href);
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    req.addEventListener("load", evt => {
        let respObj = JSON.parse(req.response);
        
        document.getElementById("titleStatus").innerHTML = "";
        document.getElementById("titleError").innerHTML = "";
        if (respObj.status)
            document.getElementById("titleStatus").innerHTML = respObj.status;
        if (respObj.error)
            document.getElementById("titleError").innerHTML = respObj.error;
    })
    req.send(JSON.stringify({title: inp.value}));
}

function checkPasswordMatch() {
    let pele = document.getElementById("password2");
    let cele = document.getElementById("cpassword");
    if (cele.value.length && pele.value != cele.value) {
        cele.setCustomValidity('Passwords do not match!');
        cele.reportValidity();
    } else {
        cele.setCustomValidity('');
        cele.reportValidity();
    }
}