# Create VTEX IO App

## 📌 Next steps

- Go to the generated app folder in the terminal.
- Authenticate to vtex-cli using a VTEX account where you want to run the new app:

  ```shell
  vtex login {{accountName}}
  ```

- Create a workspace:

  ```shell
  vtex use {{workspaceName}}
  ```

- Link the new app:
  ```shell
  vtex link --clean
  ```

Then you will have some samples to start your project:

- Route `/_v/{{APP_NAME}}/get-repositories-by-org/:org` in the backend to list the repositories of a GitHub organization.

- Custom page containing a custom block at the URL `https://{{workspaceName}}--{{accountName}}.myvtex.com/{{APP_NAME}}/list-repositories` consuming the route `/_v/{{APP_NAME}}/get-repositories-by-org/:org`.

- GraphQL query `getGitHubRepositoriesByOrg` in the backend to list the repositories of a GitHub organization.

- Custom page containing a custom block at the URL `https://{{workspaceName}}--{{accountName}}.myvtex.com/{{APP_NAME}}/list-repositories-graphql` consuming the GraphQL query `getGitHubRepositoriesByOrg`.

- Route `/_v/{{APP_NAME}}/tasks` in the backend to create a task or list tasks.

- Route `/_v/{{APP_NAME}}/tasks/:id` in the backend to get, update or delete a task.

- Custom page containing a custom block at the URL `https://{{workspaceName}}--{{accountName}}.myvtex.com/{{APP_NAME}}/tasks` consuming the routes `/_v/{{APP_NAME}}/tasks` and `/_v/{{APP_NAME}}/tasks/:id`.

- GraphQL queries `task` and `tasks` in the backend to get a task by id and to list tasks.

- GraphQL mutations `saveTask` and `deleteTask` in the backend to create/update a task and to delete a task.

- Custom page containing a custom block at the URL `https://{{workspaceName}}--{{accountName}}.myvtex.com/{{APP_NAME}}/tasks-graphql` consuming the GraphQL queries `task` and `tasks`, and the mutations `saveTask` and `deleteTask`.
