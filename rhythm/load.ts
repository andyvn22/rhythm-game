/// <reference path="gameData.ts" />

function makeNameUnique(desiredName: string) {
    let suffix = 2;
    let uniqueName = loadedProfile.name;
    while (Profile.all.map(x => x.name).indexOf(uniqueName) != -1) {
        uniqueName = `${desiredName} ${suffix}`;
        suffix++;
    }
    return uniqueName;
}

const loadedProfile = Profile.loadFromLink();

$(document).ready(function() {
    Profile.loadAllFromStorage();
    const uniqueName = loadedProfile.hasName ? makeNameUnique(loadedProfile.name) : "";
    const loadedName = loadedProfile.hasName ? `"${loadedProfile.name}"` : `An unnamed player`;
    const nameForPageTitle = loadedProfile.hasName ? `"${loadedProfile.name}"` : `Unnamed Player`;

    document.title = `Load ${nameForPageTitle} (${loadedProfile.completionDescription}) - Rhythm Game`;

    let oldProfile: Profile | undefined = undefined;
    let updateButtonLabel = ``;
    let additionalInfo = ``;
    let showNewButton = true;

    if (Profile.allAreTrivial) {
        oldProfile = Profile.all[0];
        updateButtonLabel = `Load the saved game from this link (${loadedProfile.completionDescription})`;
        showNewButton = false;
    } else if (Profile.all.length === 1 && !Profile.all[0].hasName && Profile.all[0].completionValue <= loadedProfile.completionValue) {
        oldProfile = Profile.all[0];
        updateButtonLabel = `Update existing progress (${oldProfile.completionDescription}) to match this link (${loadedProfile.completionDescription})`;
        additionalInfo = `<p>Someone's already reached ${oldProfile.completionDescription} complete on this device. Would you like to replace that existing progress (${oldProfile.completionDescription}) with the saved game in this link (${loadedProfile.completionDescription})?</p>`;
    } else if (loadedProfile.hasName) {
        const matches = Profile.all.filter(x => x.name === loadedProfile.name);
        if (matches.length === 1) {
            if (matches[0].completionValue < loadedProfile.completionValue) {
                oldProfile = matches[0];
                updateButtonLabel = `Replace existing "${oldProfile.name}" (${oldProfile.completionDescription}) with this link (${loadedProfile.completionDescription})`;
                additionalInfo = `<p>There's an existing player on this device named "${oldProfile.name}". Would you like to update that existing player (${oldProfile.completionDescription}) to match the saved game in this link (${loadedProfile.completionDescription})?</p>`;
            } else if (matches[0].completionValue === loadedProfile.completionValue) {
                additionalInfo = `<p>There's an existing player on this device named "${loadedProfile.name}"&mdash;with the exact same ${loadedProfile.completionDescription} completion as the saved game in this link! You must have already loaded this.</p>`;
                showNewButton = false;
            }
        }
    }

    $("#loadDialog").html(`<div id="loadDialog">
        <div id="loadedProfile">
            <p id="preamble"><span class="ui-icon ui-icon-link"></span> This link contains:</p>
            <p id="loadedName">${loadedName} <span id="profileCompletion">(${loadedProfile.completionDescription} complete)</span></p>
            ${additionalInfo}
        </div>
        <div id="buttons"></div>
    </div>`);

    if (oldProfile !== undefined) {
        $("#buttons").append($(`<div id="updateButton"></div>`).button({
            label: updateButtonLabel,
            icons: { primary: "ui-icon-arrowrefresh-1-e" }
        }).on("click", function() {
            Profile.replaceAt(Profile.all.indexOf(oldProfile!), loadedProfile);
            location.href = "./";
        }));
    }

    if (showNewButton) {
        let newButtonLabel = `Load as New Player`;
        if (loadedProfile.hasName) {
            if (loadedProfile.name === uniqueName) {
                newButtonLabel = `Load "${uniqueName}" as New Player`;
            } else {
                newButtonLabel = `Load link as new player "${uniqueName}"`;
            }
        }
    
        $("#buttons").append($(`<div id="addAsNewButton"></div>`).button({
            label: newButtonLabel,
            icons: { primary: "ui-icon-circle-plus" }
        }).on("click", function() {
            loadedProfile.name = uniqueName;
            Profile.add(loadedProfile);
            location.href = "./";
        }));
    }

    $("#loadDialog").dialog({
        title: "Load Player",
        autoOpen: false,
        modal: true,
        width: Math.min(vw(80), em(40)),
        buttons: {
            "Cancel": () => $("#loadDialog").dialog("close")
        },
        show: {
            effect: "drop",
            duration: 600
        },
        hide: {
            effect: "drop",
            duration: 600
        },
        beforeClose: function() {
            location.href = "./";
            return false;
        }
    });

    $("#loadDialog").dialog("open");
});