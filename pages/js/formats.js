const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


function formatDateToString(date, formatstring) {
    let form = "MMM DD, YYYY h:mm";
    if (formatstring) form = formatstring;
    
    let tokens = form.match(/[a-z]+|[^a-z]+|\/.*?\//gi);

    for (let i = 0; i < tokens.length; i++) {
        if (/^[a-z]/i.test(tokens[i])) {
            let nstr = "";
            switch(tokens[i]) {
                case 'YYYY': 
                    nstr = date.getFullYear();
                    break;
                case 'YY':
                    nstr = date.getFullYear().substr(2);
                    break;
                case 'M':
                    nstr = months[date.getMonth()];
                    break;
                case 'MM':
                    nstr = date.getMonth() + 1;
                    break;
                case 'MMM':
                    nstr = months[date.getMonth()].substr(0, 3);
                    break;
                case 'D':
                    nstr = days[date.getDay()];
                    break;
                case 'DD':
                    nstr = date.getDate();
                    break;
                case 'DDD':
                    nstr = shortdays[date.getDay()];
                    break;
                case 'h':
                    nstr = '' + date.getHours();
                    break;
                case 'hh':
                    nstr = '' + (date.getHours() % 12);
                    break;
                case 'mm':
                    nstr = '' + date.getMinutes();
                    if (nstr.length == 1) nstr = '0' + nstr;
                    break;
                case 'ss':
                    nstr = '' + date.getSeconds();
                    if (nstr.length == 1) nstr = '0' + nstr;
                    break;
                default:
                    console.error("Error: unrecognized format string " + tokens[i]);
            }
            tokens[i] = nstr;
        }
    }

    return tokens.join('');
}

function adjustAllDateFields() {
    let dateElements = document.querySelectorAll("[date-format]");
    for (let e of dateElements) {
        let content = e.textContent;
        // TODO: get a default date format
        let newDate = formatDateToString(new Date(content), e.getAttribute("date-format"));
        e.textContent = newDate;
    }
}