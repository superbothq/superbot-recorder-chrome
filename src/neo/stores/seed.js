import generate from "project-name-generator";
import { CommandsArray } from "../models/Command";
import UiState from "./view/UiState";

export default function seed(store) {
  function generateSuite() {
    return store.createSuite(generate({ words: 2}).spaced);
  }
  function generateTestCase() {
    return store.createTestCase(generate({ words: 2}).spaced);
  }
  const targets = ["a", "button"];
  function generateCommand(test) {
    const command = test.createCommand();
    command.setCommand(CommandsArray[Math.floor(Math.random() * CommandsArray.length)]);
    let targetChance = Math.floor(Math.random() * 10);
    command.setTarget(targetChance < targets.length ? targets[targetChance] : "");
    command.setValue(Math.floor(Math.random() * 2) ? generate({ words: 1}).spaced : "");
    return command;
  }
  function randomBetween(min, max) {
    return (Math.floor(Math.random() * (max - min)) + min);
  }
  const numberOfSuites = 5;
  for (let i = 0; i < numberOfSuites; i++) {
    let suite = generateSuite();
    for (let j = 0; j < randomBetween(1, 5); j++) {
      const testCase = generateTestCase();
      for (let k = 0; k < randomBetween(3, 6); k++) {
        generateCommand(testCase);
      }
      suite.addTestCase(testCase);
    }
  }

  const playbackTest = store.createTestCase("aa playback");
  const open = playbackTest.createCommand();
  open.setCommand("open");
  open.setTarget("https://en.wikipedia.org/wiki/Legislation");
  const firstClick = playbackTest.createCommand();
  firstClick.setCommand("clickAt");
  firstClick.setTarget("link=enacted");
  const secondClick = playbackTest.createCommand();
  secondClick.setCommand("clickAt");
  secondClick.setTarget("link=parliamentary systems");

  UiState.selectTest(playbackTest);

  return store;
}
