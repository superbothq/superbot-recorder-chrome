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

import browser from "webextension-polyfill";
import { Commands } from "../neo/models/Command";
import { registerCommand } from "./commandExecutor";

function RunCommand(id, command) {
  return browser.runtime.sendMessage(id, {
    action: "execute",
    command
  });
}

class PluginManager {
  plugins = [];

  registerPlugin(plugin) {
    this.plugins.push(plugin);
    plugin.commands.forEach(({id, name}) => {
      Commands.addCommand(id, name);
      registerCommand(id, RunCommand.bind(undefined, plugin.id, id));
    });
  }
}

export default new PluginManager();
