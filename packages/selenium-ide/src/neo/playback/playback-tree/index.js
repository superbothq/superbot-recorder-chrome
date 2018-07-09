// Licensed to the Software Freedom Conservancy (SFC) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The SFC licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { CommandNode } from "./command-node";
export { createPlaybackTree, verifyControlFlowSyntax, deriveCommandLevels, connectCommandNodes };

function createPlaybackTree(commandStack) {
  verifyControlFlowSyntax(commandStack);
  let levels = deriveCommandLevels(commandStack);
  let initNodes = initCommandNodes(commandStack, levels);
  return connectCommandNodes(initNodes);
  //Automata.startingCommandNode = nodes[0];
  //Automata.currentCommandNode = nodes[0];
  //return Automata;
}

class Automata {
  constructor() {
    this.startingCommandNode;
    this.currentCommandNode;
  }
}

const CommandName = {
  do: "do",
  else: "else",
  elseIf: "elseIf",
  end: "end",
  if: "if",
  repeatIf: "repeatIf",
  times: "times",
  while: "while"
};

function isDo(command) {
  return (command.command === CommandName.do);
}

function isElse(command) {
  return (command.command === CommandName.else);
}

function isElseOrElseIf(command) {
  return (command.command === CommandName.else ||
          command.command === CommandName.elseIf);
}

function isEnd(command) {
  return (command.command === CommandName.end);
}

function isIf(command) {
  return (command.command === CommandName.if);
}

function isLoop(command) {
  return (command.command === CommandName.while ||
          command.command === CommandName.times);
}

function isEmpty(obj) {
  if (obj) {
    return (obj.length === 0);
  } else {
    return false;
  }
}

function topOf(array) {
  let arr = array[array.length - 1];
  if (arr) {
    return arr;
  } else {
    return { };
  }
}

function verifyControlFlowSyntax(commandStack) {
  let state = [];
  commandStack.forEach(function(command, commandIndex) {
    if (verifyCommand[command.command]) {
      verifyCommand[command.command](command.command, commandIndex, commandStack, state);
    }
  });
  if (!isEmpty(state)) {
    throw "Incomplete block at " + topOf(state).command;
  } else {
    return true;
  }
}

const verifyCommand = {
  do: function (commandName, commandIndex, stack, state) {
    trackControlFlowBranchOpen(commandName, commandIndex, stack, state);
  },
  else: function (commandName, commandIndex, stack, state) {
    verifyElse(commandName, commandIndex, stack, state);
  },
  elseIf: function (commandName, commandIndex, stack, state) {
    verifyElse(commandName, commandIndex, stack, state);
  },
  end: function (commandName, commandIndex, stack, state) {
    verifyEnd(commandName, commandIndex, stack, state);
  },
  if: function (commandName, commandIndex, stack, state) {
    trackControlFlowBranchOpen(commandName, commandIndex, stack, state);
  },
  repeatIf: function (commandName, commandIndex, stack, state) {
    verifyRepeatIf(commandName, commandIndex, stack, state);
  },
  times: function (commandName, commandIndex, stack, state) {
    trackControlFlowBranchOpen(commandName, commandIndex, stack, state);
  },
  while: function (commandName, commandIndex, stack, state) {
    trackControlFlowBranchOpen(commandName, commandIndex, stack, state);
  }
};

function trackControlFlowBranchOpen (commandName, commandIndex, stack, state) {
  state.push({ command: commandName, index: commandIndex });
}

function verifyElse (commandName, commandIndex, stack, state) {
  if (!isIf(topOf(state))) {
    throw "An else / elseIf used outside of an if block";
  }
}

function verifyEnd (commandName, commandIndex, stack, state) {
  if (isLoop(topOf(state))) {
    state.pop();
  } else if (isIf(topOf(state))) {
    const numberOfElse = stack.slice(topOf(state).index, commandIndex).filter(command => isElse(command)).length;
    const allElses = stack.slice(topOf(state).index, commandIndex).filter(
      command => (command.command === CommandName.else || command.command === CommandName.elseIf));
    if (numberOfElse > 1) {
      throw "Too many else commands used";
    } else if (numberOfElse === 1 && !isElse(topOf(allElses))) {
      throw "Incorrect command order of elseIf / else";
    } else if (numberOfElse === 0 || isElse(topOf(allElses))) {
      state.pop();
    }
  } else {
    throw "Use of end without an opening keyword";
  }
}

function verifyRepeatIf (commandName, commandIndex, stack, state) {
  if (!isDo(topOf(state))) {
    throw "A repeatIf used without a do block";
  }
  state.pop();
}

function deriveCommandLevels(commandStack) {
  let level = 0;
  let levels = [];
  commandStack.forEach(function(command) {
    if (levelCommand[command.command]) {
      level = levelCommand[command.command](command, level, levels);
    } else {
      levelCommand["default"](command, level, levels);
    }
  });
  return levels;
}

let levelCommand = {
  default: function (command, level, levels) {
    levels.push(level);
    return level;
  },
  do: function (command, level, levels) {
    levels.push(level);
    level++;
    return level;
  },
  else: function (command, level, levels) {
    level--;
    levels.push(level);
    level++;
    return level;
  },
  elseIf: function (command, level, levels) {
    level--;
    levels.push(level);
    level++;
    return level;
  },
  end: function (command, level, levels) {
    level--;
    levels.push(level);
    return level;
  },
  if: function (command, level, levels) {
    levels.push(level);
    level++;
    return level;
  },
  repeatIf: function (command, level, levels) {
    level--;
    levels.push(level);
    return level;
  },
  times: function (command, level, levels) {
    levels.push(level);
    level++;
    return level;
  },
  while: function (command, level, levels) {
    levels.push(level);
    level++;
    return level;
  }
};

function initCommandNodes(commandStack, levels) {
  let commandNodes = [];
  commandStack.forEach(function(command, index) {
    let node = new CommandNode(command);
    node.index = index;
    node.level = levels[index];
    commandNodes.push(node);
  });
  return commandNodes;
}

function connectCommandNodes(commandNodeStack) {
  let _commandNodeStack = [ ...commandNodeStack ];
  let state = [];
  _commandNodeStack.forEach(function(commandNode) {
    let nextCommandNode = _commandNodeStack[commandNode.index + 1];
    if (nextCommandNode) {
      if (connectCommandNode[commandNode.command.command]) {
        connectCommandNode[commandNode.command.command](commandNode, nextCommandNode, _commandNodeStack, state);
      } else {
        connectCommandNode["default"](commandNode, nextCommandNode, _commandNodeStack, state);
      }
    }
  });
  return _commandNodeStack;
}

let connectCommandNode = {
  default: function (commandNode, nextCommandNode, stack, state) {
    let _nextCommandNode;
    if (isIf(topOf(state)) && (isElseOrElseIf(nextCommandNode.command))) {
      _nextCommandNode = findNextNodeBy(stack, commandNode.index, topOf(state).level, CommandName.end);
    } else if (isLoop(topOf(state)) && isEnd(nextCommandNode.command)) {
      _nextCommandNode = stack[topOf(state).index];
    } else {
      _nextCommandNode = nextCommandNode;
    }
    connectNext(commandNode, _nextCommandNode);
  },
  do: function (commandNode, nextCommandNode, stack, state) {
    state.push({ command: commandNode.command.command, level: commandNode.level, index: commandNode.index });
    connectNext(commandNode, nextCommandNode);
  },
  else: function (commandNode, nextCommandNode) {
    connectNext(commandNode, nextCommandNode);
  },
  elseIf: function (commandNode, nextCommandNode, stack) {
    connectConditional(commandNode, nextCommandNode, stack);
  },
  end: function (commandNode, nextCommandNode, stack, state) {
    state.pop();
    if (!isEmpty(state)) {
      let _nextCommandNode;
      if (isElseOrElseIf(nextCommandNode.command)) {
        _nextCommandNode = findNextNodeBy(stack, commandNode.index, topOf(state).level, CommandName.end);
      } else {
        _nextCommandNode = nextCommandNode;
      }
      connectNext(commandNode, _nextCommandNode);
    }
  },
  if: function (commandNode, nextCommandNode, stack, state) {
    state.push({ command: commandNode.command.command, level: commandNode.level, index: commandNode.index });
    connectConditional(commandNode, nextCommandNode, stack, state);
  },
  repeatIf: function (commandNode, nextCommandNode, stack, state) {
    connectRepeatIf(commandNode, nextCommandNode, stack, state);
    state.pop();
  },
  times: function (commandNode, nextCommandNode, stack, state) {
    state.push({ command: commandNode.command.command, level: commandNode.level, index: commandNode.index });
    connectConditional(commandNode, nextCommandNode, stack);
  },
  while: function (commandNode, nextCommandNode, stack, state) {
    state.push({ command: commandNode.command.command, level: commandNode.level, index: commandNode.index });
    connectConditional(commandNode, nextCommandNode, stack);
  }
};

function connectConditional (commandNode, nextCommandNode, stack) {
  commandNode.right = nextCommandNode;
  commandNode.left = findNextNodeBy(stack, commandNode.index, commandNode.level);
}

function connectNext (commandNode, nextCommandNode) {
  commandNode.next = nextCommandNode;
}

function connectRepeatIf (commandNode, nextCommandNode, stack, state) {
  commandNode.right = stack[topOf(state).index];
  commandNode.left = nextCommandNode;
}

function findNextNodeBy(stack, index, level, commandName) {
  for(let i = index + 1; i < stack.length + 1; i++) {
    if (commandName) {
      if (stack[i].level === level &&
          stack[i].command.command === commandName) {
        return stack[i];
      }
    } else {
      if (stack[i].level === level) {
        return stack[i];
      }
    }
  }
}
