/// <reference path="gameData.ts" />

$(document).ready(function() {
    TextLevel.initializePage();
    $("#content").html(TextLevel.current.html);
    
    $("#next").button({
        label: "Ready for the Next Level!",
        icons: { primary: "ui-icon-check" }
    }).on("click", function() {
        TextLevel.advance();
        TextLevel.exit();
    });
});