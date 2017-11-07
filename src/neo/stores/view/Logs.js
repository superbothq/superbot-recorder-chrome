import { action, observe, observable } from "mobx";
import uuidv4 from "uuid/v4";
import UiState from "./UiState";
import PlaybackState, { CommandStates } from "./PlaybackState";

export default class LogStore {
  @observable logs = [];

  constructor() {
    this.playbackDisposer = observe(PlaybackState, "isPlaying", (isPlaying) => {
      this.logPlayingState(isPlaying.newValue);
    });
    this.commandStateDisposer = observe(PlaybackState.commandState, (change) => {
      this.parseCommandStateChange(change.name, change.newValue, this.logCommandState);
    });
    this.logPlayingState = this.logPlayingState.bind(this);
    this.parseCommandStateChange = this.parseCommandStateChange.bind(this);
    this.logCommandState = this.logCommandState.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  @action.bound addLog(log, type) {
    this.logs.push({
      id: uuidv4(),
      status: type,
      message: log
    });
  }

  @action.bound clearLogs() {
    this.logs.clear();
  }

  logPlayingState(isPlaying) {
    if (isPlaying) {
      this.addLog(`Started playback of '${UiState.selectedTest.test.name}'`, LogTypes.Notice);
    } else {
      this.addLog(`Finished playback of '${UiState.selectedTest.test.name}'${PlaybackState.hasFailed ? " with errors" : " successfully"}`, LogTypes.Notice);
    }
  }

  parseCommandStateChange(commandId, status, cb) {
    const command = UiState.selectedTest.test.commands.find(({id}) => (id === commandId));
    cb(command, status);
  }

  logCommandState(command, status) {
    if (status) {
      switch(status.state) {
        case CommandStates.Pending:
          this.addLog(`Executing: ${command.command} on ${command.target}${command.value ? " with value " + command.value : ""}`);
          break;
        case CommandStates.Failed:
          this.addLog(`Execution failed: ${status.message}`, LogTypes.Error);
          break;
        case CommandStates.Passed:
          this.addLog("Success", LogTypes.Success);
          break;
      }
    }
  }

  dispose() {
    this.playbackDisposer();
    this.commandStateDisposer();
  }
}

export const LogTypes = {
  Notice: "notice",
  Success: "success",
  Error: "error"
};
