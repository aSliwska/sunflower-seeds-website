var firstLoad = true;
var isAnimationRunning = false;
var isPaused = false;
var all_seeds_amount = 670;
var requestAnimationFrame = window.requestAnimationFrame;

document.addEventListener("DOMContentLoaded", function(){
    // load animation view if nothing else has been loaded
    if (document.getElementById("content").innerHTML == "") {
        loadView("/animation");
    }

    // remove access token after refresh so user doesnt see functionality they dont have permission to use 
    getAuth("/log_check", function(res) {
        if (res != 'ok') {
            sessionStorage.removeItem("accessToken");
        }
    });
});

///////////////////////////////// AUTHORIZATION LOGIC

function askForTokenRefresh() {
    return new Promise((resolve, reject) => {
        postUnauth("/token", `{"token":"${sessionStorage.getItem("refreshToken")}"}`, function(res) {
            sessionStorage.removeItem("accessToken");
            sessionStorage.setItem("accessToken", JSON.parse(res).accessToken);
            resolve();
        });
    });
}

// still sends with an accessToken, just doesn't refresh it
function getUnauth(url, respFunc) {
    const req = new XMLHttpRequest();  

    req.open("GET", url, true);   
    req.responseType = "text";

    req.addEventListener("loadend", e => {
        if (req.status == 200) {
            respFunc(req.response);
        } 
        else {
            respFunc(req.status);
        } 
    });
        
    req.addEventListener("error", e => {
        console.log(e);
    });
    
    req.setRequestHeader("Authorization", "Basic " + sessionStorage.getItem("accessToken"));
    req.send();
}

// still sends with an accessToken, just doesn't refresh it
function postUnauth(url, msg, respFunc) {
    let req = false;
    
    // Mozilla/Safari
    if (window.XMLHttpRequest) {
        req = new XMLHttpRequest();
    }
    // IE
    else if (window.ActiveXObject) {
        req = new ActiveXObject("Microsoft.XMLHTTP");
    }

    req.addEventListener("loadend", e => {
        if (req.status == 200) {    
            respFunc(req.responseText);
        }
        else if (req.status == 401) {
            window.location.reload();
        } 
        else {
            respFunc(req.status);
        } 
    });

    req.addEventListener("error", e => {
        console.log(e);
    });

    req.open("POST", url);
    req.setRequestHeader("X-Requested-With","XMLHttpRequest");
    req.setRequestHeader("Content-Type","application/json");
    req.setRequestHeader("Authorization", "Basic " + sessionStorage.getItem("accessToken"));
    req.send(msg);        
}

// still sends with an accessToken, just doesn't refresh it
function deleteUnauth(url, respFunc) {
    const req = new XMLHttpRequest();  

    req.open("DELETE", url, true);   
    req.responseType = "text";

    req.addEventListener("loadend", e => {
        if (req.status == 200) {
            respFunc(req.response);
        } 
        else {
            respFunc(req.status);
        } 
    });
        
    req.addEventListener("error", e => {
        console.log(e);
    });
    
    req.setRequestHeader("Authorization", "Basic " + sessionStorage.getItem("accessToken"));
    req.send();
}

function getAuth(url, respFunc) {
    getUnauth(url, async function(res) {
        if (res == 403 || res == 500) {
            await askForTokenRefresh();
            getUnauth(url, respFunc) ;
        } 
        else {
            respFunc(res);
        }
    });
}

function postAuth(url, msg, respFunc) {
    postUnauth (url, msg, async function(res) {
        if (res == 403 || res == 500) {
            await askForTokenRefresh();
            postUnauth (url, msg, respFunc) ;
        } 
        else {
            respFunc(res);
        }
    });
}

function deleteAuth(url, respFunc) {
    deleteUnauth(url, async function(res) {
        if (res == 403 || res == 500) {
            await askForTokenRefresh();
            deleteUnauth(url, respFunc) ;
        } 
        else {
            respFunc(res);
        }
    });
}

function loadView(url) {
    getAuth(url, function(res) {
        if (sessionStorage.getItem("accessToken"))
            showLoggedInButtons();
        else
            showLoggedOutButtons();

        if (res == 403) {
            res = "Nie masz uprawnień do wykonania tej funkcji.";
            showLoggedOutButtons();
            sessionStorage.removeItem("accessToken");            
        }
        else if (res == 500) {
            res = "Wystąpił błąd.";
            showLoggedOutButtons();
            sessionStorage.removeItem("accessToken");
        }

        document.getElementById("content").innerHTML = res;

        if (/^\/animation/.test(url)) {
            firstLoad = true;
            isAnimationRunning = false;
            isPaused = false;
        }
    });
}

function loginUser(login, pass) {
    let url = "/login";
    let msg = `{"login":"${login}","pass":"${pass}"}`;

    postUnauth(url, msg, function(res) {
        if (res == 403 || res == 500) {
            document.getElementById("login_response").innerHTML = "Błąd logowania.";
        }
        else if (res == "wrong credentials") {
            document.getElementById("login_response").innerHTML = "Zła nazwa użytkownika lub hasło.";
        }
        else {
            sessionStorage.clear();
            sessionStorage.setItem("accessToken", JSON.parse(res).accessToken);
            sessionStorage.setItem("refreshToken", JSON.parse(res).refreshToken); 
            loadView("/profile");
            showLoggedInButtons();
        }
    });
}

function logoutUser() {
    postUnauth('/logout', `{"token":"${sessionStorage.getItem("refreshToken")}"}`, function(res){
        if (res == "ok") {
            sessionStorage.removeItem("accessToken");
            showLoggedOutButtons();
            loadView('/animation');
        }
    });
}

function registerUser(login, pass) {
    let url = "/register";
    let msg = `{"login":"${login}","pass":"${pass}"}`;

    postUnauth(url, msg, function(res) {
        if (res == 403 || res == 500) {
            document.getElementById("register_response").innerHTML = "Błąd rejestracji.";
        }
        else if (res == "login taken") {
            document.getElementById("register_response").innerHTML = "Nazwa użytkownika zajęta.";
        }
        else {
            sessionStorage.clear();
            sessionStorage.setItem("accessToken", JSON.parse(res).accessToken);
            sessionStorage.setItem("refreshToken", JSON.parse(res).refreshToken); 
            document.getElementById("register_response").innerHTML = "Zarejestrowano pomyślnie! Jesteś zalogowany.";
            showLoggedInButtons();
        }
    });
}

function showLoggedInButtons() {
    document.getElementById("profile_button").style.display = "";
    document.getElementById("register_button").style.display = "none";
    document.getElementById("login_button").style.display = "none";
}

function showLoggedOutButtons() {
    document.getElementById("profile_button").style.display = "none";
    document.getElementById("register_button").style.display = "";
    document.getElementById("login_button").style.display = "";
}


///////////////////////////////// DATABASE LOGIC

function saveParameters(name, visible_center, animation_speed, seed_size, seed_color, background_color, start_angle, end_angle) {
    postAuth('/parameters', `{"name": "${name}", "visible_center":${visible_center}, "animation_speed":${animation_speed}, "seed_size":${seed_size}, "seed_color":"${seed_color}", "background_color":"${background_color}", "start_angle":${start_angle}, "end_angle":${end_angle}}`, function(res) {
        if (res === "ok") {
            document.getElementById("save_response").innerHTML = "Zapisano parametry.";
        }
        else if (res === "name taken") {
            document.getElementById("save_response").innerHTML = "Nazwa zestawu parametrów musi być niepusta i oryginalna.";
        }
        else if (res == 403) {
            document.getElementById("save_response").innerHTML = "Zapisywanie możliwe tylko dla zalogowanych użytkowników.";
        }
        else {
            document.getElementById("save_response").innerHTML = "Błąd zapisu.";
        }
    });
}

function loadParameters(name) {
    loadView('/animation/'+name);
}

function deleteParameters(name) {
    deleteAuth('/parameters/'+name, function(res) {
        if (res === "ok") {
            document.getElementById("parameters_box_" + name).style.display = "none";
        }
        else {
            console.log(res);
        }
    });
}











//////////////////////////////// ANIMATION LOGIC

// adds logic to seeds that executes when their animation finishes
function addAnimationEvents() {
    let svg = document.getElementById("svg_box");

    for (let i = 0; i < all_seeds_amount - 1; i++) {
        let c = svg.getElementById('c' + i);
        c.addEventListener("animationend",  function() {
            c.classList.remove("animateDescriptor");
            c.style['animationPlayState'] = 'running';
        });
    }

    // last seed gets to set the animation flag down
    let c = svg.getElementById('c' + (all_seeds_amount-1));
    c.addEventListener("animationend",  function() {
        c.classList.remove("animateDescriptor");
        c.style['animationPlayState'] = 'running';

        // end animation procedure
        if (!isPaused) {
            document.getElementById("play_pause_button").classList.toggle("pushed");
        }
        isAnimationRunning = false;
        isPaused = false;
        disableForm(false);
    });
}

// updates the angle slider & number displayed when the animation is running
function updateAngle() {
    let computed_rotation = getComputedStyle(document.querySelector('#c0')).getPropertyValue("transform");

    if (typeof computed_rotation.split('(')[1] === 'undefined')
        return;

    let values = computed_rotation.split('(')[1].split(')')[0].split(',');
    var radians = Math.atan2(values[1], values[0]);
    if ( radians < 0 )
        radians += (2 * Math.PI);
    let angle = Math.round((1.0 - radians/(2 * Math.PI)) * 1000000) / 1000000;

    if (document.getElementById("angle_value").disabled)
        document.getElementById("angle_value").value = angle;
    if (document.getElementById("angle_slider").disabled)
        document.getElementById("angle_slider").value = angle;
    
    requestAnimationFrame(updateAngle);
}

// play pause resume logic
function toggle_animation_state() {
    // after site reload add end animation events again
    if (firstLoad) {
        addAnimationEvents();
        firstLoad = false;
    }
    
    let play_button = document.getElementById("play_pause_button");
    let svg = document.getElementById("svg_box");

    //  pause or resume animation - 2 animations can't run simultanously
    if (isAnimationRunning) {
        for (let i = 0; i < all_seeds_amount; i++) {
            svg.getElementById('c' + i).style['animationPlayState'] = isPaused ? 'running' : 'paused';
        }
        isPaused = !isPaused;
        play_button.classList.toggle("pushed");
        return;
    }

    // start new animation
    play_button.classList.toggle("pushed");
    disableForm(true);
    
    let start_angle = validateAngle(document.getElementById("start_value").value);
    let end_angle = validateAngle(document.getElementById("end_value").value);    
    let speed = document.getElementById("speed_slider").value;

    let animation_duration = "" + (Math.abs(end_angle - start_angle) / (speed*speed/10000)) + "s";

    let beg_change = 360*start_angle;
    let beg = beg_change;
    let end_change = 360*end_angle;
    let end = end_change;

    // trigger animation for each seed
    for (let i = 0; i < all_seeds_amount; i++) {
        let c = svg.getElementById('c' + i);
        c.style['animationDuration'] = animation_duration;
        c.style.setProperty('--seed-start-rotation', "-" + beg + "deg");
        c.style.setProperty('--seed-end-rotation', "-" + end + "deg");
        c.classList.add("animateDescriptor");
        beg += beg_change;
        end += end_change;
    }  
    
    isAnimationRunning = true;
    
    requestAnimationFrame(updateAngle);
}

function trigger_animation_end() {
    let svg = document.getElementById("svg_box");
    let animation_end_event = new Event("animationend");

    for (let i = 0; i < all_seeds_amount; i++) {
        svg.getElementById('c' + i).dispatchEvent(animation_end_event);
    }
}

function disableForm(truth_val) {
    document.getElementById("angle_slider").disabled = truth_val;
    document.getElementById("angle_value").disabled = truth_val;
    document.getElementById("show_center").disabled = truth_val;
    document.getElementById("speed_slider").disabled = truth_val;
    document.getElementById("seed_size_slider").disabled = truth_val;
    document.getElementById("seed_color").disabled = truth_val;
    document.getElementById("background_color").disabled = truth_val;
    document.getElementById("start_value").disabled = truth_val;
    document.getElementById("end_value").disabled = truth_val;
}

function showCenter(doShow) {
    let ccenter = document.getElementById("ccenter");
    if (doShow)
        ccenter.style.display = "";
    else
        ccenter.style.display = "none";
}

function changeSeedSize(size) {
    let svg = document.getElementById("svg_box");

    for (let i = 0; i < all_seeds_amount; i++)
        svg.getElementById('c' + i).setAttribute('r', size);
}

function changeSeedColor(color) {
    let svg = document.getElementById("svg_box");

    svg.getElementById('ccenter').setAttribute('stroke', color);
    svg.getElementById('ccenter').setAttribute('fill', color);
    for (let i = 0; i < all_seeds_amount; i++)
        svg.getElementById('c' + i).setAttribute('stroke', color);
}

function changeBackgroundColor(color) {
    let svg = document.getElementById("svg_box");
    svg.style.backgroundColor = color;
}

function rotateSeeds(angle) {
    angle = validateAngle(angle);
    let svg = document.getElementById("svg_box");

    let change = 360*angle;
    let final_angle = change;

    for (let i = 0; i < all_seeds_amount; i++) {
        svg.getElementById('c' + i).style.transform = "rotate(-"+final_angle+"deg)";
        final_angle += change;
    }
}

function validateAngle(angle) {
    if (angle > 1)
        return 1;
    if (angle < 0)
        return 0;
    return angle;
}


