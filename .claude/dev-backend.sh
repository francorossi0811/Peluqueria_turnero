#!/bin/bash
export PATH="/Users/francorossi/.nvm/versions/node/v24.18.1/bin:$PATH"
cd "$(dirname "$0")/../backend"
exec npm run dev
