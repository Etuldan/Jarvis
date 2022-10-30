const { ButtonStyle, ButtonBuilder, ActionRowBuilder } = require('discord.js');


class ButtonContract extends ButtonBuilder {
    constructor(contract) {
        super()
            .setCustomId(contract._id.toString())
            .setLabel(contract.name + " $" + contract.amount)
            .setStyle(ButtonStyle.Success);
        this.contract = contract;
        if(contract.paid) {
            this.setDisabled(true);
        }
        if(!contract.positive) {
            this.setStyle(ButtonStyle.Danger);
        }
    }

    
    validate() {
        this.setDisabled(true);
    }

    static from(buttonComponent)
    {
        return super.from(buttonComponent.contract);
    }
}

class ActionRowContract extends ActionRowBuilder {
    constructor() {
        super()
    }
}

module.exports = {
    ButtonContract,
    ActionRowContract
};