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

import { Commands } from "../../models/Command";

export default function migrate(project) {
  let r = Object.assign({}, project);
  r.tests = r.tests.map((test) => {
    return Object.assign({}, test, {
      commands: test.commands.map((c) => {
        let newCmd = Object.assign({}, c);
        if (c.command === "waitForVisible" || c.command === "waitForEditable") {
          newCmd.command = migrateCommand(newCmd.command);
          return newCmd;
        } else {
          return c;
        }
      })
    });
  });
  return r;
}

function migrateCommand(command) {
  return command.replace(/waitFor/g, "waitForElement");
}

migrate.version = "1.1";
