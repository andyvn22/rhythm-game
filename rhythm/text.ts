/// <reference path="gameData.ts" />

$(document).ready(function() {
    TextLevel.initializePage();
    $("#content").html(TextLevel.current.html);
    
    $("#next").button({
        label: TextLevel.current.isEnd ? "The End!" : "Ready for the Next Level!",
        icons: { primary: "ui-icon-check" }
    }).on("click", function() {
        TextLevel.pass();
        TextLevel.exit();
    });
});