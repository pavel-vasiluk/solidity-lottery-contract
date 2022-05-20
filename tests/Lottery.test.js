const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());
const {abi, evm} = require('../compile');

let accounts;
let lottery;

beforeEach(async () => {
    // Get a list of all accounts
    accounts = await web3.eth.getAccounts();

    // Use one of those accounts to deploy the contract
    lottery = await new web3.eth.Contract(abi)
        .deploy({data: evm.bytecode.object})
        .send({from: accounts[0], gas: 1000000})
});

describe('Lottery Contract', () => {
    it('deploys a contract', () => {
        assert.ok(lottery.options.address);
    })

    it('allows one account to enter', async () => {
        await lottery.methods.enter().send({
            from: accounts[0],
            value: web3.utils.toWei('0.02', 'ether'),
        });

        const players = await lottery.methods.getPlayers().call({from: accounts[0]});

        assert.equal(players[0], accounts[0]);
        assert.equal(players.length, 1);
    })

    it('allows multiple accounts to enter', async () => {
        const indexes = [0, 1, 2];

        for (const index of indexes) {
            await lottery.methods.enter().send({
                from: accounts[index],
                value: web3.utils.toWei('0.02', 'ether'),
            });
        }

        const players = await lottery.methods.getPlayers().call({from: accounts[0]});

        assert.equal(players[0], accounts[0]);
        assert.equal(players[1], accounts[1]);
        assert.equal(players[2], accounts[2]);
        assert.equal(players.length, 3);
    })

    it('requires a minimum amount of ether to enter', async () => {
        let hasFailed = false;

        try {
            await lottery.methods.enter().send({
                from: accounts[0],
                value: web3.utils.toWei('0.01', 'ether'),
            });
        } catch (error) {
            hasFailed = true;
        }

        assert.equal(hasFailed, true);
    })

    it('only manager can call pickWinner function', async () => {
        // add at least one player to lottery
        await lottery.methods.enter().send({
            from: accounts[1],
            value: web3.utils.toWei('2', 'ether'),
        });

        let hasFailed = false;

        try {
            await lottery.methods.pickWinner().send({from: accounts[1]});
        } catch (error) {
            hasFailed = true;
        }

        assert.equal(hasFailed, true);
    })

    it('sends money to the winner and resets players array', async () => {
        await lottery.methods.enter().send({
            from: accounts[1],
            value: web3.utils.toWei('2', 'ether'),
        });

        const initialBalance = await web3.eth.getBalance(accounts[1]);
        await lottery.methods.pickWinner().send({from: accounts[0]});
        const finalBalance = await web3.eth.getBalance(accounts[1]);
        const difference = finalBalance - initialBalance;

        assert(difference > web3.utils.toWei('1.9', 'ether'));

        const players = await lottery.methods.getPlayers().call({from: accounts[0]});

        assert.equal(players.length, 0);
    })
})