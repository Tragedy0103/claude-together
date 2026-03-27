PROJECT  := xlab-435802
REGION   := asia-east1
REPO     := xlab-registry
IMAGE    := claude-together
TAG      := latest

REMOTE   := $(REGION)-docker.pkg.dev/$(PROJECT)/$(REPO)/$(IMAGE)

.PHONY: build push deploy all

build:
	docker buildx build --platform linux/amd64 -t $(REMOTE):$(TAG) --push .

push: build

deploy: push
	kubectl rollout restart deployment/claude-together -n production

all: deploy
