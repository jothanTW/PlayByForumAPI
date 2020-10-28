let ExpandedPost = function(parent, num, userObject, text, date, characterObject) {
    this.parent = parent;
    this.num = num;
    this.header = {
        name : userObject.id,
        date: date
    }
    this.textBlock = {
        text: text,
        ooc: ""
    }
    this.edit = {
        date: null,
        recstack: 0
    }

    if (characterObject) {
        this.header.alias = characterObject.id;
        this.header.title = characterObject.title;
        this.header.icon = characterObject.av;
        this.header.char = characterObject.name;
    } else {
        //this.header.alias = userObject.id;
        this.header.title = userObject.title;
        this.header.icon = userObject.av;
    }
}

module.exports = ExpandedPost;