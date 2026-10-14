#!/bin/bash
# This is a script used by the devcontainer to build the project

# install dependencies
yarn install

# Build Server Dependencies
yarn polycanvas @polycanvas/server-native build

# Create database
yarn polycanvas @polycanvas/server prisma migrate reset -f
