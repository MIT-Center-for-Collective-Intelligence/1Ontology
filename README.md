# 1Ontology

1Ontology is a Next.js web application designed to systematically organize and share a vast array of business knowledge, including basic principles, key scientific results, and useful case examples. Developed by the MIT Center for Collective Intelligence, this platform aims to facilitate the creation, distribution, and discovery of organizational knowledge for researchers, educators, students, computer scientists, information technologists, software developers, managers, and consultants.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgments](#acknowledgments)

## Introduction

The 1Ontology project is inspired by the vision of the MIT Process Handbook project, which has been guiding research and development for over a decade. The goal is to create a knowledge base that is not only extensive but also structured in a way that enhances the discovery of new ideas and best practices.

## Features

- **Knowledge Organization**: Organize business knowledge into a structured and searchable format.
- **Collaboration**: Share and collaborate on knowledge with a global community.
- **Case Examples**: Access and contribute to a library of case examples and best practices.
- **Customization**: Create specific versions of the knowledge base tailored to individual organizational needs.

## Project Structure

The project is structured as follows:

- `components/`: Contains reusable React components, including authentication, headers, layouts, and ontology-related components.
- `lib/`: Includes utility functions, hooks, theme configurations, and Firestore client setup.
- `pages/`: Next.js pages for the application's routing.
- `types/`: TypeScript interfaces and types for the application.
- `FilesStructurePrinter.js`: Utility script for printing the file structure (not part of the application runtime).

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (LTS version recommended)
- npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/ImanYZ/1Ontology.git
   ```
2. Navigate to the project directory
   ```sh
   cd 1Ontology
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Create a `.env.local` file in the root directory and fill it with the necessary environment variables based on `.env.example`.

5. Start the development server
   ```sh
   npm run dev
   ```

## Usage

After installation, you can start using the application to organize and share knowledge. Use the provided components and pages to navigate through the knowledge base, contribute new content, and collaborate with others.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the Apache-2.0 license. See `LICENSE` for more information.

## Contact

MIT Center for Collective Intelligence - [email](mailto:oneweb@umich.edu)

Project Link: [https://github.com/ImanYZ/1Ontology](https://github.com/ImanYZ/1Ontology)

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [Material-UI](https://mui.com/)
- [Firebase](https://firebase.google.com/)
- [D3.js](https://d3js.org/)
- [And all other dependencies listed in `package.json`](./package.json)
